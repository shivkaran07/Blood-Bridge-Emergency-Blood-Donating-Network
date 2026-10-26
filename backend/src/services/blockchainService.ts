import type { AuthContext, BlockchainSyncStatus } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import {
  blockchainSyncCounts,
  countBlockchainTransactions,
  listBlockchainTransactions,
  pendingAnchorRequests,
  blockchainTransactionCountForRequest,
} from '../repositories/blockchainRepository.js';
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
];

/**
 * Truthful integration status. Part 1 has no deployed contract and no on-chain
 * connectivity, regardless of placeholder environment values.
 */
export async function getBlockchainStatus(deps: ServiceDeps, _ctx: AuthContext) {
  const counts = await blockchainSyncCounts(deps.db);
  const syncCounts = Object.fromEntries(
    ALL_SYNC_STATUSES.map((status) => [status, 0]),
  ) as Record<BlockchainSyncStatus, number>;
  for (const row of counts) {
    syncCounts[row.blockchain_sync_status] = Number(row.count);
  }

  const totalTransactions = await countBlockchainTransactions(deps.db);
  const recent = await listBlockchainTransactions(deps.db, { requestId: null, limit: 10 });
  const pendingAnchors = await pendingAnchorRequests(deps.db);

  return {
    phase: 'PART_1_PREPARED',
    prepared: true,
    connected: false,
    operational: false,
    enabledByConfiguration: deps.config.blockchain.enabled,
    contractAddressConfigured: Boolean(deps.config.blockchain.contractAddress),
    networkName: deps.config.blockchain.networkName,
    chainId: deps.config.blockchain.chainId,
    verificationMode: 'DATABASE',
    syncCounts,
    pendingAnchors,
    transactionsRecorded: totalTransactions,
    recentTransactions: recent.map((tx) => ({
      id: tx.id,
      requestId: tx.request_id,
      auditKey: tx.blockchain_audit_key,
      networkName: tx.network_name,
      chainId: Number(tx.chain_id),
      contractAddress: tx.contract_address,
      transactionHash: tx.transaction_hash,
      action: tx.action,
      status: tx.transaction_status,
      blockNumber: tx.block_number === null ? null : Number(tx.block_number),
      createdAt: toIso(tx.created_at),
    })),
    explanation:
      'Part 1 implements the audit schema, opaque audit references and synchronization states only. No smart contract is deployed, no wallet is connected and no blockchain transaction has been submitted. Database verification is not blockchain verification.',
    nextPhase:
      'Part 2 will deploy the Solidity contract, integrate an authorized verifier wallet and record real transaction hashes after confirmation.',
  };
}

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

  return {
    requestId: request.id,
    blockchainAuditKey: request.blockchain_audit_key,
    blockchainSyncStatus: request.blockchain_sync_status,
    verificationMode: 'DATABASE' as const,
    blockchainVerified: request.blockchain_sync_status === 'CONFIRMED',
    transactionCount: count,
    transactions: transactions.map((tx) => ({
      id: tx.id,
      transactionHash: tx.transaction_hash,
      networkName: tx.network_name,
      chainId: Number(tx.chain_id),
      action: tx.action,
      status: tx.transaction_status,
      blockNumber: tx.block_number === null ? null : Number(tx.block_number),
      createdAt: toIso(tx.created_at),
    })),
    note: 'No blockchain anchor is created in Part 1.',
  };
}
