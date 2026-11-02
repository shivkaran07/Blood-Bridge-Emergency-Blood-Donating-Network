import type { Db } from '../db/database.js';
import type {
  BlockchainAnchorAction,
  BlockchainSyncStatus,
  BlockchainTransactionRow,
} from '../types/domain.js';
import type { BlockchainStatusCount } from './types.js';

export async function blockchainSyncCounts(db: Db): Promise<BlockchainStatusCount[]> {
  const result = await db.query<BlockchainStatusCount>(
    `select blockchain_sync_status, count(*)::int as count
       from public.blood_requests
      group by blockchain_sync_status`,
  );
  return result.rows;
}

export async function countBlockchainTransactions(db: Db): Promise<number> {
  const result = await db.query<{ count: number }>(
    'select count(*)::int as count from public.blockchain_transactions',
  );
  return result.rows[0]?.count ?? 0;
}

export async function listBlockchainTransactions(
  db: Db,
  options: { requestId: string | null; limit: number },
): Promise<BlockchainTransactionRow[]> {
  const result = await db.query<BlockchainTransactionRow>(
    `select *
       from public.blockchain_transactions
      where ($1::uuid is null or request_id = $1)
      order by created_at desc
      limit $2`,
    [options.requestId, options.limit],
  );
  return result.rows;
}

export async function blockchainTransactionCountsForRequests(
  db: Db,
  requestIds: string[],
): Promise<Map<string, number>> {
  if (requestIds.length === 0) return new Map();
  const result = await db.query<{ request_id: string; count: number }>(
    `select request_id, count(*)::int as count
       from public.blockchain_transactions
      where request_id = any($1::uuid[])
      group by request_id`,
    [requestIds],
  );
  return new Map(result.rows.map((row) => [row.request_id, row.count]));
}

export async function blockchainTransactionCountForRequest(
  db: Db,
  requestId: string,
): Promise<number> {
  const result = await db.query<{ count: number }>(
    'select count(*)::int as count from public.blockchain_transactions where request_id = $1',
    [requestId],
  );
  return result.rows[0]?.count ?? 0;
}

export async function pendingAnchorRequests(db: Db): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.blood_requests
      where status = 'VERIFIED' and blockchain_sync_status = 'NOT_SCHEDULED'`,
  );
  return result.rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Part 2: wallet-anchor operations
// ---------------------------------------------------------------------------

export interface CreateOperationInput {
  requestId: string;
  auditKey: string;
  action: BlockchainAnchorAction;
  networkName: string;
  chainId: number;
  contractAddress: string;
  actorUserId: string;
}

/**
 * Inserts the PENDING operation row for one (request, action) pair. The
 * table-level partial unique index guarantees at most one open operation, so
 * a concurrent duplicate attempt fails here instead of double-anchoring.
 */
export async function insertBlockchainOperation(
  db: Db,
  input: CreateOperationInput,
): Promise<BlockchainTransactionRow> {
  const result = await db.query<BlockchainTransactionRow>(
    `insert into public.blockchain_transactions
       (request_id, blockchain_audit_key, network_name, chain_id,
        contract_address, action, transaction_status, actor_user_id)
     values ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
     returning *`,
    [
      input.requestId,
      input.auditKey,
      input.networkName,
      input.chainId,
      input.contractAddress.toLowerCase(),
      input.action,
      input.actorUserId,
    ],
  );
  return result.rows[0]!;
}

/** At most one open operation at a time (PENDING or SUBMITTED). */
export async function findOpenOperationForRequest(
  db: Db,
  requestId: string,
  action: BlockchainAnchorAction,
): Promise<BlockchainTransactionRow | undefined> {
  const result = await db.query<BlockchainTransactionRow>(
    `select * from public.blockchain_transactions
      where request_id = $1
        and action = $2
        and transaction_status in ('PENDING', 'SUBMITTED')
      order by created_at desc
      limit 1`,
    [requestId, action],
  );
  return result.rows[0];
}

export async function findBlockchainOperation(
  db: Db,
  operationId: string,
): Promise<BlockchainTransactionRow | undefined> {
  const result = await db.query<BlockchainTransactionRow>(
    'select * from public.blockchain_transactions where id = $1',
    [operationId],
  );
  return result.rows[0];
}

/** Locks the operation row so concurrent confirms serialize on it. */
export async function findBlockchainOperationForUpdate(
  db: Db,
  operationId: string,
): Promise<BlockchainTransactionRow | undefined> {
  const result = await db.query<BlockchainTransactionRow>(
    'select * from public.blockchain_transactions where id = $1 for update',
    [operationId],
  );
  return result.rows[0];
}

/**
 * Records the wallet-provided hash; SINGLE transition PENDING -> SUBMITTED.
 * Returns false when the row was not PENDING (e.g. already confirmed),
 * which makes retrying the same confirmation idempotent.
 */
export async function attachOperationHash(
  db: Db,
  operationId: string,
  transactionHash: string,
  sourceAddress: string,
): Promise<boolean> {
  const result = await db.query<BlockchainTransactionRow>(
    `update public.blockchain_transactions
        set transaction_status = 'SUBMITTED',
            transaction_hash = $2,
            source_address = $3,
            updated_at = now()
      where id = $1
      returning *`,
    [operationId, transactionHash, sourceAddress.toLowerCase()],
  );
  return result.rows.length === 1;
}

export interface OperationTerminalUpdate {
  transactionStatus: 'CONFIRMED' | 'FAILED' | 'NEEDS_RECONCILIATION';
  transactionHash: string;
  blockNumber: number | null;
  sourceAddress: string | null;
  errorMessage: string | null;
}

export async function setOperationTerminal(
  db: Db,
  operationId: string,
  update: OperationTerminalUpdate,
): Promise<void> {
  await db.query(
    `update public.blockchain_transactions
        set transaction_status = $2::public.blockchain_transaction_status,
            transaction_hash = $3,
            block_number = $4,
            source_address = coalesce($5::text, source_address),
            error_message = $6,
            confirmed_at = case when $7 then now() else confirmed_at end,
            updated_at = now()
      where id = $1`,
    [
      operationId,
      update.transactionStatus,
      update.transactionHash,
      update.blockNumber,
      update.sourceAddress,
      update.errorMessage?.slice(0, 500) ?? null,
      update.transactionStatus === 'CONFIRMED',
    ],
  );
}

/** Flags an operation whose on-chain truth was recorded after a DB failure. */
export async function markOperationNeedsReconciliation(
  db: Db,
  operationId: string,
  errorMessage: string,
): Promise<void> {
  await db.query(
    `update public.blockchain_transactions
        set transaction_status = 'NEEDS_RECONCILIATION',
            error_message = $2,
            updated_at = now()
      where id = $1`,
    [operationId, errorMessage.slice(0, 500)],
  );
}

/** Idempotent DB-side repair after reconciliation verified the chain truth. */
export async function setBlockchainOperationConfirmed(
  db: Db,
  operationId: string,
  blockNumber: number | null,
): Promise<void> {
  await db.query(
    `update public.blockchain_transactions
        set transaction_status = 'CONFIRMED',
            block_number = $2,
            confirmed_at = now(),
            error_message = null,
            updated_at = now()
      where id = $1
        and transaction_status in ('SUBMITTED', 'NEEDS_RECONCILIATION')`,
    [operationId, blockNumber],
  );
}

/** Only lists operations the viewer may see (admin sees everything). */
export async function listBlockchainOperations(
  db: Db,
  options: { requestId: string | null; actorUserId: string | null; limit: number },
): Promise<BlockchainTransactionRow[]> {
  const result = await db.query<BlockchainTransactionRow>(
    `select * from public.blockchain_transactions
      where ($1::uuid is null or request_id = $1)
        and ($2::uuid is null or actor_user_id = $2)
      order by created_at desc
      limit $3`,
    [options.requestId, options.actorUserId, options.limit],
  );
  return result.rows;
}

/**
 * Marks the request's synchronization status. `NOT_SCHEDULED` is reserved for
 * requests never prepared; a decision that is pending on-chain shows
 * AWAITING_WALLET until the wallet transaction is confirmed.
 */
export async function setRequestBlockchainSyncStatus(
  db: Db,
  requestId: string,
  status: BlockchainSyncStatus,
): Promise<void> {
  await db.query(
    `update public.blood_requests
        set blockchain_sync_status = $2::public.blockchain_sync_status,
            updated_at = now()
      where id = $1`,
    [requestId, status],
  );
}
