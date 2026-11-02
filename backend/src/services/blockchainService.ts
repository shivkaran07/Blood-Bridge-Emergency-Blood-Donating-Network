import type { AuthContext, BlockchainSyncStatus, BlockchainTransactionRow } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import { deriveVerificationMode } from '../config/env.js';
import {
  blockchainSyncCounts,
  countBlockchainTransactions,
  listBlockchainTransactions,
  pendingAnchorRequests,
  blockchainTransactionCountForRequest,
} from '../repositories/blockchainRepository.js';
import { listOperationsForViewer } from './anchorService.js';
import { findRequestById } from '../repositories/requestRepository.js';
import { isRequestOwner } from './access.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { toIso } from '../lib/serialize.js';

const ALL_SYNC_STATUSES: BlockchainSyncStatus[] = [
  'NOT_SCHEDULED',
  'AWAITING_WALLET',
  'SUBMITTED',
  'CONFIRMED',
  'FAILED',
  'NEEDS_RECONCILIATION',
];

/**
 * Truthful integration status. Any claim of on-chain connectivity comes from
 * a live health probe - never from configuration values alone.
 */
export async function getBlockchainStatus(deps: ServiceDeps, _ctx: AuthContext) {
  const mode = deriveVerificationMode(deps.config.blockchain);
  const onChain = mode === 'ON_CHAIN' && deps.chain !== null;

  const counts = await blockchainSyncCounts(deps.db);
  const syncCounts = Object.fromEntries(
    ALL_SYNC_STATUSES.map((status) => [status, 0]),
  ) as Record<BlockchainSyncStatus, number>;
  for (const row of counts) {
    syncCounts[row.blockchain_sync_status] = Number(row.count);
  }

  const totalTransactions = await countBlockchainTransactions(deps.db);
  const pendingAnchors = await pendingAnchorRequests(deps.db);
  const recent = await listOperationsForViewer(deps, _ctx, { requestId: null, limit: 15 });
  const legacyTransactions = await listBlockchainTransactions(deps.db, {
    requestId: null,
    limit: 15,
  });

  let chainHealth: {
    connected: boolean;
    chainId: number | null;
    latestBlock: number | null;
    error: string | null;
  } | null = null;
  if (onChain) {
    chainHealth = await deps.chain!.getHealth();
  }

  return {
    phase: 'PART_2',
    verificationMode: mode,
    enabledByConfiguration: deps.config.blockchain.enabled,
    contractAddressConfigured: Boolean(deps.config.blockchain.contractAddress),
    operational: Boolean(onChain && chainHealth?.connected),
    connected: Boolean(chainHealth?.connected),
    chainHealth,
    networkName: deps.config.blockchain.networkName,
    chainId: deps.config.blockchain.chainId,
    contractAddress:
      onChain ? deps.chain!.contractAddress() : deps.config.blockchain.contractAddress,
    syncCounts,
    pendingAnchors,
    transactionsRecorded: totalTransactions,
    recentTransactions: legacyTransactions.map((tx) => {
      const row = tx as BlockchainTransactionRow;
      return {
        id: row.id,
        transactionHash: row.transaction_hash,
        networkName: row.network_name,
        chainId: Number(row.chain_id),
        contractAddress: row.contract_address,
        action: row.action,
        status: row.transaction_status,
        blockNumber: row.block_number === null ? null : Number(row.block_number),
        createdAt: toIso(row.created_at),
      };
    }),
    openOperations: recent.filter((op) => op.status === 'PENDING' || op.status === 'SUBMITTED'),
    operations: recent,
    explanation:
      mode === 'ON_CHAIN'
        ? 'Verification anchors are recorded on the BloodBridge contract through wallet-signed transactions that this backend independently verifies (receipt status, recipient, sender, event arguments, contract state) before updating the database.'
        : 'Verification is database-backed. The contract has not been deployed or configured, so no wallet-signed anchor transactions are created and no request status is presented as on-chain.',
  };
}

/**
 * Per-request blockchain audit record. `blockchainVerified` is true only when
 * the sync status is CONFIRMED - a wallet transaction was mined, verified by
 * the backend and the request was updated accordingly.
 */
export async function getRequestBlockchainRecord(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
) {
  const request = await findRequestById(deps.db, requestId);
  if (!request) throw new NotFoundError('Blood request not found.');

  const canView =
    isRequestOwner(ctx, request) || ctx.isAdmin || ctx.isApprovedHospital;
  if (!canView) {
    throw new ForbiddenError('You are not authorized to view this request\'s audit reference.');
  }

  const transactions = await listBlockchainTransactions(deps.db, { requestId, limit: 50 });
  const count = await blockchainTransactionCountForRequest(deps.db, requestId);
  const mode = deriveVerificationMode(deps.config.blockchain);

  return {
    requestId: request.id,
    blockchainAuditKey: request.blockchain_audit_key,
    blockchainSyncStatus: request.blockchain_sync_status,
    verificationMode: mode,
    onChainStatus: request.status,
    blockchainVerified: request.blockchain_sync_status === 'CONFIRMED',
    transactionCount: count,
    transactions: transactions.map((tx) => toOperationRowLite(tx)),
    note:
      request.blockchain_sync_status === 'CONFIRMED'
        ? 'This decision is anchored on the BloodBridge contract and was verified by the backend against the chain.'
        : mode === 'ON_CHAIN'
          ? 'Decision anchors in on-chain mode go through wallet-signed transactions confirmed by the backend before the database status changes.'
          : 'Database verification never creates an anchor transaction. This record reflects application state only.',
  };
}

function toOperationRowLite(tx: BlockchainTransactionRow) {
  return {
    id: tx.id,
    transactionHash: tx.transaction_hash,
    sourceAddress: tx.source_address,
    networkName: tx.network_name,
    chainId: Number(tx.chain_id),
    contractAddress: tx.contract_address,
    action: tx.action,
    status: tx.transaction_status,
    blockNumber: tx.block_number === null ? null : Number(tx.block_number),
    errorMessage: tx.error_message,
    confirmedAt: tx.confirmed_at === null ? null : toIso(tx.confirmed_at),
    createdAt: toIso(tx.created_at),
    updatedAt: toIso(tx.updated_at),
  };
}
