import type { AuthContext, BlockchainAnchorAction, BlockchainTransactionRow, WalletBindingRow } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import type { AnchorOperationDto } from '../blockchain/types.js';
import {
  auditKeyToBytes32,
  type AnchorVerification,
  type OnChainStatus,
} from '../blockchain/adapter.js';
import {
  attachOperationHash,
  findBlockchainOperation,
  findBlockchainOperationForUpdate,
  findOpenOperationForRequest,
  insertBlockchainOperation,
  listBlockchainOperations,
  markOperationNeedsReconciliation,
  setBlockchainOperationConfirmed,
  setOperationTerminal,
  setRequestBlockchainSyncStatus,
} from '../repositories/blockchainRepository.js';
import {
  findRequestById,
  findRequestForUpdate,
  insertRequestHistory,
  setRequestCompletion,
  setRequestRejected,
  setRequestUnderReview,
  setRequestVerified,
} from '../repositories/requestRepository.js';
import { findWalletBinding } from '../repositories/walletRepository.js';
import { deriveVerificationMode } from '../config/env.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../lib/errors.js';
import { toIso } from '../lib/serialize.js';
import { notifyUsers, writeAudit } from './notificationService.js';
import { assertRequestTransition } from './statusMachine.js';

const FUNCTION_NAME_BY_ACTION: Record<
  BlockchainAnchorAction,
  'recordVerifiedRequest' | 'recordRejectedRequest' | 'recordTerminalStatus'
> = {
  VERIFY_REQUEST: 'recordVerifiedRequest',
  REJECT_REQUEST: 'recordRejectedRequest',
  FULFILL_REQUEST: 'recordTerminalStatus',
};

const TARGET_DB_STATUS: Record<BlockchainAnchorAction, 'VERIFIED' | 'REJECTED' | 'FULFILLED'> = {
  VERIFY_REQUEST: 'VERIFIED',
  REJECT_REQUEST: 'REJECTED',
  FULFILL_REQUEST: 'FULFILLED',
};

const CONTRACT_TARGET_STATUS: Record<BlockchainAnchorAction, OnChainStatus> = {
  VERIFY_REQUEST: 'VERIFIED',
  REJECT_REQUEST: 'REJECTED',
  FULFILL_REQUEST: 'COMPLETED',
};

const AUDIT_FOR_ACTION: Record<
  BlockchainAnchorAction,
  'REQUEST_VERIFIED' | 'REQUEST_REJECTED' | 'REQUEST_FULFILLED'
> = {
  VERIFY_REQUEST: 'REQUEST_VERIFIED',
  REJECT_REQUEST: 'REQUEST_REJECTED',
  FULFILL_REQUEST: 'REQUEST_FULFILLED',
};

const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export interface PreparedAnchor {
  operation: AnchorOperationDto;
}

export function requireChain(deps: ServiceDeps): NonNullable<ServiceDeps['chain']> {
  if (deriveVerificationMode(deps.config.blockchain) !== 'ON_CHAIN' || deps.chain === null) {
    throw new ConflictError(
      'Blockchain verification is not active. This deployment is database-backed.',
    );
  }
  if (deps.chain.contractAddress() === null) {
    throw new ServiceUnavailableError(
      'No BloodBridge contract address is configured. Deploy the contract first.',
    );
  }
  return deps.chain;
}

/**
 * Chain pre-checks performed BEFORE any database write so an honest 4xx
 * response is returned without leaving pending rows behind.
 */
async function assertChainReadyForAction(
  deps: ServiceDeps,
  ctx: AuthContext,
  action: BlockchainAnchorAction,
  auditKey: string,
  walletAddress: string,
): Promise<void> {
  const chain: NonNullable<ServiceDeps['chain']> = requireChain(deps);

  // 13.5: the bound wallet must hold VERIFIER_ROLE ON CHAIN. Wallet binding
  // alone (or app-level hospital approval) is never sufficient.
  const hasRole = await chain.isVerifier(walletAddress).catch(() => false);
  if (!hasRole) {
    throw new ForbiddenError(
      'The verified wallet does not hold VERIFIER_ROLE on the BloodBridge contract. Ask the contract administrator to grant it.',
    );
  }

  // 13.7: current request state must match the on-chain record. A request
  // verified through the database can never be completed on chain later: the
  // contract state for its audit key is still NONE and recordTerminalStatus
  // would revert - surface that as an honest conflict, not a 500.
  const onChainStatus = await chain.getOnChainStatus(auditKey).catch((error: Error) => {
    throw new ServiceUnavailableError(`The chain is not reachable right now: ${error.message}`);
  });
  if (action === 'FULFILL_REQUEST') {
    if (onChainStatus === 'NONE') {
      throw new ConflictError(
        'The request has no on-chain verification record, so completion cannot be recorded on chain. Database-only decisions never touch the contract.',
      );
    }
    if (onChainStatus !== 'VERIFIED') {
      throw new ConflictError(
        `The on-chain record for this request is ${onChainStatus}, a terminal state that cannot be reused.`,
      );
    }
  } else if (onChainStatus !== 'NONE') {
    throw new ConflictError(
      `The contract already holds a ${onChainStatus} record for this audit key. A new transaction would revert, so it was not prepared.`,
    );
  }
}

/**
 * Prepares a PENDING anchor operation. Everything in this function runs the
 * access-control checklist before any row exists:
 *   1. approved hospital account           (controller middleware)
 *   2. wallet ownership binding for actor
 *   3. VERIFIER_ROLE on chain for the bound wallet
 *   4. on-chain record state compatible with the action
 *   5. valid database transition + non-expired request
 *   6. no other open operation for (request, action)
 */
export async function prepareAnchorOperation(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
  action: BlockchainAnchorAction,
  reviewReason: string | null = null,
): Promise<AnchorOperationDto> {
  requireChain(deps);

  const binding = await findWalletBinding(deps.db, ctx.user.id);
  if (!binding) {
    throw new ForbiddenError(
      'Verify wallet ownership first: connect your wallet, sign the ownership challenge, then retry.',
    );
  }

  // The audit key lives on the request row; check the chain state with it
  // before opening any transaction.
  const requestSeed = await findRequestById(deps.db, requestId);
  if (!requestSeed) throw new NotFoundError('Blood request not found.');
  await assertChainReadyForAction(
    deps,
    ctx,
    action,
    requestSeed.blockchain_audit_key,
    binding.wallet_address,
  );

  const operation = await deps.db.transaction(async (tx) => {
    const request = await findRequestForUpdate(tx, requestId);
    if (!request) throw new NotFoundError('Blood request not found.');
    if (new Date(request.needed_by).getTime() <= Date.now()) {
      throw new ConflictError('The required-by time for this request has passed.');
    }
    if (request.requester_id === ctx.user.id) {
      throw new ForbiddenError('You cannot anchor an on-chain decision for your own blood request.');
    }

    let fromStatus = request.status;
    if (action === 'FULFILL_REQUEST') {
      if (fromStatus !== 'VERIFIED') {
        throw new ConflictError(
          'Only a request verified on chain can be marked complete on chain.',
        );
      }
      if (request.blockchain_sync_status !== 'CONFIRMED') {
        throw new ConflictError(
          `The database has not confirmed this request's on-chain verification yet (status: ${request.blockchain_sync_status}).`,
        );
      }
      assertRequestTransition(fromStatus, 'FULFILLED');
    } else {
      if (fromStatus === 'SUBMITTED') {
        assertRequestTransition(fromStatus, 'UNDER_REVIEW');
        await setRequestUnderReview(tx, request.id);
        await insertRequestHistory(tx, {
          requestId: request.id,
          fromStatus,
          toStatus: 'UNDER_REVIEW',
          actorUserId: ctx.user.id,
          reason: 'Automatically claimed for review.',
        });
        fromStatus = 'UNDER_REVIEW';
      }
      assertRequestTransition(fromStatus, TARGET_DB_STATUS[action]);
    }

    // A completed verification is a prerequisite for a later on-chain
    // completion. Do not mistake that confirmed anchor for an open duplicate.
    // For initial verify/reject decisions, however, an existing or in-flight
    // sync operation must block preparing another transaction.
    if (
      action !== 'FULFILL_REQUEST' &&
      ['SUBMITTED', 'CONFIRMED', 'NEEDS_RECONCILIATION'].includes(request.blockchain_sync_status)
    ) {
      throw new ConflictError(
        `This request already has a blockchain operation in progress (sync status: ${request.blockchain_sync_status}).`,
      );
    }

    const open = await findOpenOperationForRequest(tx, requestId, action);
    if (open) {
      throw new ConflictError(
        'An open anchor operation already exists for this request and action. Confirm it or wait for it to finish - a second transaction is never created automatically.',
        { existingOperationId: open.id, existingStatus: open.transaction_status },
      );
    }

    const chain = requireChain(deps);
    const contractAddress = chain.contractAddress();
    if (!contractAddress) {
      throw new ServiceUnavailableError('No BloodBridge contract address is configured.');
    }

    const operationRow = await insertBlockchainOperation(tx, {
      requestId: request.id,
      auditKey: request.blockchain_audit_key,
      action,
      networkName: deps.config.blockchain.networkName,
      chainId: deps.config.blockchain.chainId,
      contractAddress,
      actorUserId: ctx.user.id,
    });

    await setRequestBlockchainSyncStatus(tx, request.id, 'AWAITING_WALLET');

    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: request.id,
      eventType: 'BLOCKCHAIN_ANCHOR_PREPARED',
      metadata: {
        operationId: operationRow.id,
        action,
        reviewReason,
        expectedStatus: CONTRACT_TARGET_STATUS[action],
      },
    });

    return operationRow;
  });

  return toOperationDto(deps, operation, binding);
}

/** Shapes the operation for the frontend, including the wallet signature target. */
export function toOperationDto(
  deps: ServiceDeps,
  row: BlockchainTransactionRow,
  binding?: WalletBindingRow | null,
): AnchorOperationDto {
  const bindingAddress = binding?.wallet_address ?? '';
  const action = row.action as BlockchainAnchorAction;
  const auditKey = row.blockchain_audit_key;
  const args =
    action === 'FULFILL_REQUEST' ? [auditKeyToBytes32(auditKey), '4'] : [auditKeyToBytes32(auditKey)];
  return {
    operationId: row.id,
    requestId: row.request_id,
    auditKey,
    action,
    functionName: FUNCTION_NAME_BY_ACTION[action],
    args,
    contractAddress: row.contract_address,
    chainId: Number(row.chain_id),
    networkName: row.network_name,
    expectedFromAddress: bindingAddress,
    expectedStatus: CONTRACT_TARGET_STATUS[action],
    createdAt: toIso(row.created_at),
  };
}

/** Compact row shape used by listing endpoints and the audit dashboard. */
export function toOperationRowDto(deps: ServiceDeps, row: BlockchainTransactionRow) {
  return {
    id: row.id,
    requestId: row.request_id,
    auditKey: row.blockchain_audit_key,
    action: row.action,
    functionName: FUNCTION_NAME_BY_ACTION[row.action as BlockchainAnchorAction],
    networkName: row.network_name,
    chainId: Number(row.chain_id),
    contractAddress: row.contract_address,
    transactionHash: row.transaction_hash,
    sourceAddress: row.source_address,
    status: row.transaction_status,
    blockNumber: row.block_number === null ? null : Number(row.block_number),
    errorMessage: row.error_message,
    confirmedAt: row.confirmed_at === null ? null : toIso(row.confirmed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface AnchorOutcome {
  status: 'CONFIRMED' | 'FAILED' | 'PENDING_RECONCILIATION';
  operationId: string;
  transactionHash: string | null;
  failure: { reason: string; message: string } | null;
  requestId: string;
}

/**
 * Confirms a wallet-signed operation. The DB is updated ONLY after the
 * backend's own chain verification succeeds (receipt status, recipient,
 * sender, event arguments, contract state). Any DB failure after chain
 * success marks the operation NEEDS_RECONCILIATION instead of losing the
 * chain truth; retries are idempotent and never create a second transaction.
 */
export async function confirmAnchorOperation(
  deps: ServiceDeps,
  ctx: AuthContext,
  operationId: string,
  transactionHash: string,
): Promise<AnchorOutcome> {
  const hash = transactionHash?.trim() ?? '';
  if (!TX_HASH_PATTERN.test(hash)) {
    throw new ValidationError('Provide a valid transaction hash (0x + 64 hex characters).');
  }

  const op = await findBlockchainOperation(deps.db, operationId);
  if (!op) throw new NotFoundError('Blockchain operation not found.');
  if (!op.actor_user_id) {
    throw new ConflictError('This operation has no recorded actor and cannot be confirmed.');
  }
  if (op.actor_user_id !== ctx.user.id && !ctx.isAdmin) {
    throw new ForbiddenError('Only the account that prepared this operation can confirm it.');
  }

  // Existing terminal states (idempotent retries / honest conflicts).
  const existing = await anchorOutcomeForTerminal(deps, op);
  if (existing) return existing;

  const binding = await findWalletBinding(deps.db, op.actor_user_id);
  if (!binding) {
    throw new ConflictError('The wallet for this account is not verified anymore.');
  }

  if (op.contract_address.toLowerCase() !== (requireChain(deps).contractAddress() ?? '').toLowerCase()) {
    throw new ConflictError(
      'The configured contract address changed since this operation was prepared. Start a new decision.',
    );
  }

  const expectation = {
    auditKey: op.blockchain_audit_key,
    expectedToStatus: CONTRACT_TARGET_STATUS[op.action as BlockchainAnchorAction],
    expectedFrom: binding.wallet_address,
    contractAddress: op.contract_address,
  };

  const verification: AnchorVerification = await requireChain(deps).verifyAnchorTx(hash, expectation);
  if (verification.ok) {
    // The wallet might have submitted from a different account than the bound
    // one - SENDER_MISMATCH is a hard failure recorded below.
    return applyChainTruth(deps, {
      operationId: op.id,
      requestId: op.request_id,
      action: op.action as BlockchainAnchorAction,
      actorUserId: op.actor_user_id,
      verification,
      reconcile: false,
    });
  }

  if (verification.retryable) {
    // Persist the wallet-submitted hash even if its receipt is not visible yet.
    // This lets the same operation be reconciled after an RPC timeout/restart
    // and prevents a retry from creating a duplicate transaction.
    await deps.db.transaction(async (tx) => {
      await attachOperationHash(tx, op.id, hash, binding.wallet_address);
      await setRequestBlockchainSyncStatus(tx, op.request_id, 'SUBMITTED');
    });
    return {
      status: 'PENDING_RECONCILIATION',
      operationId: op.id,
      transactionHash: hash,
      failure: { reason: verification.reason, message: verification.message },
      requestId: op.request_id,
    };
  }

  await applyAnchorFailure(deps, op, hash, verification, binding.wallet_address);
  return {
    status: 'FAILED',
    operationId: op.id,
    transactionHash: hash,
    failure: { reason: verification.reason, message: verification.message },
    requestId: op.request_id,
  };
}

async function anchorOutcomeForTerminal(
  deps: ServiceDeps,
  op: NonNullable<Awaited<ReturnType<typeof findBlockchainOperation>>>,
): Promise<AnchorOutcome | null> {
  if (op.transaction_status === 'CONFIRMED') {
    return {
      status: 'CONFIRMED',
      operationId: op.id,
      transactionHash: op.transaction_hash,
      failure: null,
      requestId: op.request_id,
    };
  }
  if (op.transaction_status === 'FAILED' && op.transaction_hash) {
    return {
      status: 'FAILED',
      operationId: op.id,
      transactionHash: op.transaction_hash,
      failure: {
        reason: op.error_message ?? 'TX_FAILED',
        message: op.error_message ?? 'The transaction failed. Start a new decision to retry.',
      },
      requestId: op.request_id,
    };
  }
  return null;
}

/**
 * Writes the confirmed chain truth into the database in one transaction.
 * Shared by confirm and reconcile. If the transaction itself fails the
 * operation is flagged NEEDS_RECONCILIATION and the request is kept honest.
 */
async function applyChainTruth(deps: ServiceDeps, input: {
  operationId: string;
  requestId: string;
  action: BlockchainAnchorAction;
  actorUserId: string;
  verification: Extract<AnchorVerification, { ok: true }>;
  reconcile: boolean;
}): Promise<AnchorOutcome> {
  const { verification } = input;
  try {
    await deps.db.transaction(async (tx) => {
      const locked = await findBlockchainOperationForUpdate(tx, input.operationId);
      if (!locked) throw new NotFoundError('Blockchain operation not found.');
      if (locked.transaction_status === 'CONFIRMED') return; // idempotent retry
      if (locked.transaction_status === 'FAILED') {
        throw new ConflictError('This operation already failed; it cannot be confirmed.');
      }

      await attachOperationHash(
        tx,
        locked.id,
        verification.transactionHash,
        verification.fromAddress,
      );

      const request = await findRequestForUpdate(tx, input.requestId);
      if (!request) throw new NotFoundError('Blood request not found.');
      const fromStatus = request.status;
      const toStatus = TARGET_DB_STATUS[input.action];
      assertRequestTransition(fromStatus, toStatus);

      if (input.action === 'VERIFY_REQUEST') {
        await setRequestVerified(tx, request.id, input.actorUserId, null);
      } else if (input.action === 'REJECT_REQUEST') {
        await setRequestRejected(tx, request.id, input.actorUserId, 'Recorded as REJECTED on chain.');
      } else {
        await setRequestCompletion(tx, request.id, 'FULFILLED');
      }
      await insertRequestHistory(tx, {
        requestId: request.id,
        fromStatus,
        toStatus,
        actorUserId: input.actorUserId,
        reason: `Recorded on chain by the BloodBridge contract (tx ${verification.transactionHash}).`,
      });
      await writeAudit(tx, {
        actorUserId: input.actorUserId,
        requestId: request.id,
        eventType: AUDIT_FOR_ACTION[input.action],
        metadata: {
          previousStatus: fromStatus,
          verificationMode: 'ON_CHAIN',
          transactionHash: verification.transactionHash,
          blockNumber: verification.blockNumber,
          onChainStatus: verification.contractStatus,
        },
      });
      await writeAudit(tx, {
        actorUserId: input.actorUserId,
        requestId: request.id,
        eventType: 'BLOCKCHAIN_ANCHOR_CONFIRMED',
        metadata: {
          operationId: locked.id,
          action: input.action,
          transactionHash: verification.transactionHash,
          blockNumber: verification.blockNumber,
          reconciled: input.reconcile,
        },
      });
      if (input.reconcile) {
        await writeAudit(tx, {
          actorUserId: input.actorUserId,
          requestId: request.id,
          eventType: 'BLOCKCHAIN_RECONCILE_CONFIRMED',
          metadata: { operationId: locked.id, transactionHash: verification.transactionHash },
        });
      }
      await setBlockchainOperationConfirmed(tx, locked.id, verification.blockNumber);
      await setRequestBlockchainSyncStatus(tx, request.id, 'CONFIRMED');

      const messageByAction: Record<BlockchainAnchorAction, string> = {
        VERIFY_REQUEST:
          'A hospital verifier recorded your request as verified on the BloodBridge contract. Donors can now see it.',
        REJECT_REQUEST:
          'A hospital verifier recorded a rejection for your blood request on chain.',
        FULFILL_REQUEST:
          'The verifying hospital recorded your request as completed on the BloodBridge contract.',
      };
      await notifyUsers(tx, [request.requester_id], {
        type: input.action === 'VERIFY_REQUEST'
          ? 'REQUEST_VERIFIED'
          : input.action === 'REJECT_REQUEST'
            ? 'REQUEST_REJECTED'
            : 'REQUEST_FULFILLED',
        title:
          input.action === 'VERIFY_REQUEST'
            ? 'Request verified on chain'
            : input.action === 'REJECT_REQUEST'
              ? 'Request not verified'
              : 'Request fulfilled on chain',
        message: messageByAction[input.action],
        requestId: request.id,
      });
    });
  } catch (dbError) {
    if (dbError instanceof ConflictError) throw dbError;
    // Chain success + database failure: never lose the truth. The pending
    // state is preserved and reconciliation can repair the row later.
    await markOperationNeedsReconciliation(
      deps.db,
      input.operationId,
      `Chain confirmed but database update failed: ${(dbError as Error).message}`,
    ).catch(() => undefined);
    await deps.db
      .transaction((tx) => setRequestBlockchainSyncStatus(tx, input.requestId, 'NEEDS_RECONCILIATION'))
      .catch(() => undefined);
    await deps.logger.warn(
      { operationId: input.operationId, requestId: input.requestId, errMessage: (dbError as Error).message },
      'Blockchain anchor confirmed on chain but the database update failed',
    );
    return {
      status: 'PENDING_RECONCILIATION',
      operationId: input.operationId,
      transactionHash: verification.transactionHash,
      failure: {
        reason: 'DB_UPDATE_FAILED',
        message: 'The transaction is confirmed on chain; the database could not be updated and stays flagged for reconciliation.',
      },
      requestId: input.requestId,
    };
  }

  return {
    status: 'CONFIRMED',
    operationId: input.operationId,
    transactionHash: verification.transactionHash,
    failure: null,
    requestId: input.requestId,
  };
}

/**
 * Records a hard failure (revert, mismatch, wrong chain). The request's
 * database status is deliberately NOT changed.
 */
async function applyAnchorFailure(
  deps: ServiceDeps,
  op: BlockchainTransactionRow,
  hash: string,
  failure: Extract<AnchorVerification, { ok: false }>,
  sourceAddress: string | null,
): Promise<void> {
  try {
    await deps.db.transaction(async (tx) => {
      await setOperationTerminal(tx, op.id, {
        transactionStatus: 'FAILED',
        transactionHash: hash,
        blockNumber: null,
        sourceAddress,
        errorMessage: `${failure.reason}: ${failure.message}`,
      });
      await setRequestBlockchainSyncStatus(tx, op.request_id, 'FAILED');
      await writeAudit(tx, {
        actorUserId: op.actor_user_id,
        requestId: op.request_id,
        eventType: 'BLOCKCHAIN_ANCHOR_FAILED',
        metadata: { operationId: op.id, action: op.action, reason: failure.reason },
      });
    });
  } catch (error) {
    console.error('TRACE applyAnchorFailure failed:', error);
    deps.logger.warn(
      { operationId: op.id, errMessage: (error as Error).message },
      'Failed to persist anchor failure',
    );
  }
}

/**
 * Repairs an operation whose on-chain state exists but whose database row is
 * not CONFIRMED (a previous confirm crash, RPC outage, or NEEDS_RECONCILIATION
 * DB failure). Re-verifies the chain truth first; never invents state.
 */
export async function reconcileAnchorOperation(
  deps: ServiceDeps,
  ctx: AuthContext,
  operationId: string,
): Promise<AnchorOutcome> {
  const op = await findBlockchainOperation(deps.db, operationId);
  if (!op) throw new NotFoundError('Blockchain operation not found.');
  if (!op.actor_user_id) {
    throw new ConflictError('This operation has no recorded actor and cannot be reconciled.');
  }
  if (op.actor_user_id !== ctx.user.id && !ctx.isAdmin) {
    throw new ForbiddenError('Only the account that prepared this operation, or an administrator, can reconcile it.');
  }

  if (op.transaction_status === 'CONFIRMED') {
    return {
      status: 'CONFIRMED',
      operationId: op.id,
      transactionHash: op.transaction_hash,
      failure: null,
      requestId: op.request_id,
    };
  }
  if (op.transaction_status === 'PENDING') {
    throw new ConflictError('No wallet transaction was submitted for this operation yet.');
  }
  if (op.transaction_status === 'FAILED') {
    throw new ConflictError('This operation already failed on chain. Start a new decision.');
  }

  const hash = op.transaction_hash;
  if (!hash) {
    throw new ConflictError('No transaction hash is recorded for this operation.');
  }

  const binding = await findWalletBinding(deps.db, op.actor_user_id);
  if (!binding) {
    throw new ConflictError('The wallet for this account is not verified anymore.');
  }

  const verification = await requireChain(deps).verifyAnchorTx(hash, {
    auditKey: op.blockchain_audit_key,
    expectedToStatus: CONTRACT_TARGET_STATUS[op.action as BlockchainAnchorAction],
    expectedFrom: binding.wallet_address,
    contractAddress: op.contract_address,
  });

  if (!verification.ok) {
    if (verification.retryable) {
      return {
        status: 'PENDING_RECONCILIATION',
        operationId: op.id,
        transactionHash: hash,
        failure: { reason: verification.reason, message: verification.message },
        requestId: op.request_id,
      };
    }
    await applyAnchorFailure(deps, op, hash, verification, null);
    await deps.db
      .transaction((tx) =>
        writeAudit(tx, {
          actorUserId: op.actor_user_id,
          requestId: op.request_id,
          eventType: 'BLOCKCHAIN_RECONCILE_FAILED',
          metadata: { operationId: op.id, reason: verification.reason },
        }),
      )
      .catch(() => undefined);
    return {
      status: 'FAILED',
      operationId: op.id,
      transactionHash: hash,
      failure: { reason: verification.reason, message: verification.message },
      requestId: op.request_id,
    };
  }

  return applyChainTruth(deps, {
    operationId: op.id,
    requestId: op.request_id,
    action: op.action as BlockchainAnchorAction,
    actorUserId: op.actor_user_id,
    verification,
    reconcile: true,
  });
}

/**
 * Lists operations for the blockchain audit dashboard. Administrators see
 * everything; other accounts see only the operations they prepared.
 */
export async function listOperationsForViewer(
  deps: ServiceDeps,
  ctx: AuthContext,
  options: { requestId: string | null; limit: number },
) {
  const rows = await listBlockchainOperations(deps.db, {
    requestId: options.requestId,
    actorUserId: ctx.isAdmin ? null : ctx.user.id,
    limit: options.limit,
  });
  return rows.map((row) => toOperationRowDto(deps, row));
}
