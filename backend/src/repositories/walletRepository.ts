import type { Db } from '../db/database.js';
import type { WalletBindingRow, WalletChallengeRow } from '../types/domain.js';
import { randomHex, sha256Hex } from '../lib/crypto.js';

const CHALLENGE_PURPOSE = 'WALLET_BINDING' as const;

export interface ChallengeMaterial {
  challengeId: string;
  /** Raw nonce that is embedded in the signed message. */
  nonce: string;
  message: string;
  expiresAtMs: number;
}

interface CreateChallengeInput {
  userId: string;
  walletAddress: string;
  message: string;
  nonce: string;
  expiresAtMs: number;
}

export async function insertWalletChallenge(db: Db, input: CreateChallengeInput): Promise<ChallengeMaterial> {
  const result = await db.query<WalletChallengeRow>(
    `insert into public.wallet_challenges
       (user_id, wallet_address, nonce_hash, message_hash, purpose, expires_at)
     values ($1, $2, $3, $4, $5, to_timestamp($6::double precision / 1000))
     returning *,
       to_timestamp($6::double precision / 1000)::text as expires_at_iso`,
    [
      input.userId,
      input.walletAddress.toLowerCase(),
      sha256Hex(input.nonce),
      sha256Hex(input.message),
      CHALLENGE_PURPOSE,
      input.expiresAtMs,
    ],
  );
  const row = result.rows[0]!;
  return {
    challengeId: row.id,
    nonce: input.nonce,
    message: input.message,
    expiresAtMs: new Date(row.expires_at as string).getTime(),
  };
}

export function randomNonce(): string {
  return randomHex(16);
}

/**
 * Enforces one active challenge per user: previous unconsumed challenges for
 * this user + wallet are invalidated so a stale frontend cannot replay them.
 */
export async function invalidateOpenChallenges(db: Db, userId: string, walletAddress: string): Promise<void> {
  await db.query(
    `update public.wallet_challenges
        set consumed_at = now()
      where user_id = $1
        and wallet_address = $2
        and consumed_at is null
        and expires_at > now()`,
    [userId, walletAddress.toLowerCase()],
  );
}

export async function findChallengeByIdHash(
  db: Db,
  nonceHash: string,
): Promise<WalletChallengeRow | undefined> {
  const result = await db.query<WalletChallengeRow>(
    `select * from public.wallet_challenges where nonce_hash = $1`,
    [nonceHash],
  );
  return result.rows[0];
}

export async function findChallengeByMessageHash(
  db: Db,
  messageHash: string,
): Promise<WalletChallengeRow | undefined> {
  const result = await db.query<WalletChallengeRow>(
    `select * from public.wallet_challenges where message_hash = $1`,
    [messageHash],
  );
  return result.rows[0];
}

/** Marks the challenge consumed atomically; false when it was already used. */
export async function consumeChallenge(db: Db, challengeId: string): Promise<boolean> {
  const result = await db.query<{ consumed_by_this_call: boolean }>(
    `update public.wallet_challenges
        set consumed_at = now()
      where id = $1 and consumed_at is null
      returning true as consumed_by_this_call`,
    [challengeId],
  );
  return result.rows.length === 1;
}

export async function findWalletBinding(
  db: Db,
  userId: string,
): Promise<WalletBindingRow | undefined> {
  const result = await db.query<WalletBindingRow>(
    'select * from public.wallet_bindings where user_id = $1',
    [userId],
  );
  return result.rows[0];
}

export async function findBindingByWallet(
  db: Db,
  walletAddress: string,
): Promise<WalletBindingRow | undefined> {
  const result = await db.query<WalletBindingRow>(
    'select * from public.wallet_bindings where wallet_address = $1',
    [walletAddress.toLowerCase()],
  );
  return result.rows[0];
}

export async function upsertWalletBinding(
  db: Db,
  input: { userId: string; walletAddress: string; chainId: number },
): Promise<WalletBindingRow> {
  const result = await db.query<WalletBindingRow>(
    `insert into public.wallet_bindings (user_id, wallet_address, chain_id, verified_at)
     values ($1, $2, $3, now())
     on conflict (user_id) do update
       set wallet_address = excluded.wallet_address,
           chain_id = excluded.chain_id,
           verified_at = now(),
           updated_at = now()
     returning *`,
    [input.userId, input.walletAddress.toLowerCase(), input.chainId],
  );
  return result.rows[0]!;
}

export async function deleteWalletBinding(db: Db, userId: string): Promise<boolean> {
  const result = await db.query<{ deleted: boolean }>(
    `with removed as (delete from public.wallet_bindings
       where user_id = $1 returning 1 as deleted)
     select exists(select 1 from removed) as deleted`,
    [userId],
  );
  return result.rows[0]?.deleted ?? false;
}
