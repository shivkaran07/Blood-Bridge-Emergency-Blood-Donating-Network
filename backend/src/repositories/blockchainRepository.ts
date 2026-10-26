import type { Db } from '../db/database.js';
import type { BlockchainTransactionRow } from '../types/domain.js';
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
