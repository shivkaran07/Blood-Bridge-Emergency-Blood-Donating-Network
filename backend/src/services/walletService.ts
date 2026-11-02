import { verifyMessage } from 'ethers';

import type { AuthContext, WalletBindingRow } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import {
  consumeChallenge,
  deleteWalletBinding,
  findBindingByWallet,
  findChallengeByMessageHash,
  findWalletBinding,
  insertWalletChallenge,
  invalidateOpenChallenges,
  randomNonce,
  upsertWalletBinding,
  type ChallengeMaterial,
} from '../repositories/walletRepository.js';
import { sha256Hex } from '../lib/crypto.js';
import {
  ConflictError,
  ForbiddenError,
  isCheckViolation,
  isUniqueViolation,
  ValidationError,
} from '../lib/errors.js';
import { toIso } from '../lib/serialize.js';
import { writeAudit } from './notificationService.js';

const WALLET_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export interface WalletStatusDto {
  bound: boolean;
  walletAddress: string | null;
  chainId: number | null;
  verifiedAt: string | null;
  /**
   * True only when the chain adapter confirmed the VERIFIER_ROLE is held.
   * False means the role is not held OR the role status could not be
   * determined (e.g. RPC outage). Check onChainRoleStatus for the distinction.
   */
  hasOnChainVerifierRole: boolean;
  /**
   * 'GRANTED'    – chain confirmed the role is held.
   * 'NOT_GRANTED' – chain confirmed the role is not held.
   * 'UNAVAILABLE' – the role could not be checked (RPC error, no adapter).
   * 'NOT_APPLICABLE' – no wallet is bound or blockchain mode is disabled.
   */
  onChainRoleStatus: 'GRANTED' | 'NOT_GRANTED' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
  note: string;
}

export interface WalletChallengeDto {
  challengeId: string;
  walletAddress: string;
  message: string;
  expiresAt: string;
  instructions: string[];
}

export interface WalletBindingDto {
  walletAddress: string;
  chainId: number;
  verifiedAt: string;
}

type RoleStatus = WalletStatusDto['onChainRoleStatus'];

/**
 * Queries the chain adapter for VERIFIER_ROLE, distinguishing a confirmed
 * false (role genuinely not held) from a communication failure (RPC outage).
 * Returns a typed status value rather than a boolean so callers can surface
 * appropriate UI messages rather than conflating "not authorized" with
 * "status unavailable".
 */
async function resolveOnChainRoleStatus(
  chain: ServiceDeps['chain'],
  walletAddress: string,
): Promise<RoleStatus> {
  if (!chain) return 'NOT_APPLICABLE';
  try {
    const held = await chain.isVerifier(walletAddress);
    return held ? 'GRANTED' : 'NOT_GRANTED';
  } catch {
    // RPC or adapter error: we do not know whether the role is held.
    // Return UNAVAILABLE so callers can display the correct message instead
    // of falsely reporting that the role has not been granted.
    return 'UNAVAILABLE';
  }
}

function toStatusDto(
  binding: WalletBindingRow | undefined,
  roleStatus: RoleStatus,
): WalletStatusDto {
  return {
    bound: Boolean(binding),
    walletAddress: binding?.wallet_address ?? null,
    chainId: binding ? Number(binding.chain_id) : null,
    verifiedAt: binding ? toIso(binding.verified_at) : null,
    hasOnChainVerifierRole: roleStatus === 'GRANTED',
    onChainRoleStatus: roleStatus,
    note:
      'Wallet ownership is verified through a signed challenge and stored privately. Binding a wallet never grants verifier privileges by itself; VERIFIER_ROLE is a separate on-chain grant made by the contract administrator.',
  };
}

/**
 * Exact message the wallet must sign. Deterministic so the backend can verify
 * the signature against the stored hash without trusting the client's replay
 * of any field the wallet did not sign.
 */
export function buildWalletMessage(input: {
  walletAddress: string;
  nonce: string;
  issuedAtMs: number;
  expiresAtMs: number;
  chainId: number;
}): string {
  return [
    'BloodBridge - wallet ownership verification',
    '',
    `Wallet:   ${input.walletAddress}`,
    `Chain:    ${input.chainId}`,
    `Nonce:    ${input.nonce}`,
    `Issued:   ${new Date(input.issuedAtMs).toISOString()}`,
    `Expires:  ${new Date(input.expiresAtMs).toISOString()}`,
    '',
    'Signing this message only proves you control this wallet.',
    'It does NOT approve any transaction and it moves no funds.',
  ].join('\n');
}

/**
 * Issues a fresh single-use challenge for the account + wallet pair, wrapping
 * it up in the SIWE-like message the frontend hands to MetaMask for signing.
 */
export async function issueWalletChallenge(
  deps: ServiceDeps,
  ctx: AuthContext,
  walletAddressInput: string,
): Promise<WalletChallengeDto> {
  const walletAddress = walletAddressInput?.trim() ?? '';
  if (!WALLET_ADDRESS_PATTERN.test(walletAddress)) {
    throw new ValidationError('Provide a valid 0x Ethereum wallet address.');
  }
  const wallet = walletAddress.toLowerCase();

  // A wallet can be owned by only one account and an account can only have
  // one wallet. Fail early with an honest conflict instead of an insert error.
  const existingByWallet = await findBindingByWallet(deps.db, wallet);
  if (existingByWallet && existingByWallet.user_id !== ctx.user.id) {
    throw new ConflictError('This wallet is already bound to a different account.');
  }

  const nowMs = Date.now();
  const expiresAtMs = nowMs + deps.config.blockchain.walletChallengeTtlSeconds * 1000;
  const nonce = randomNonce();
  const message = buildWalletMessage({
    walletAddress: wallet,
    nonce,
    issuedAtMs: nowMs,
    expiresAtMs,
    chainId: deps.config.blockchain.chainId,
  });

  // One active challenge per user + wallet: invalidate previous ones so a
  // stale signed message from an earlier page load can never be replayed.
  await invalidateOpenChallenges(deps.db, ctx.user.id, wallet);
  const challenge: ChallengeMaterial = await insertWalletChallenge(deps.db, {
    userId: ctx.user.id,
    walletAddress: wallet,
    nonce,
    message,
    expiresAtMs,
  });

  await writeAudit(deps.db, {
    actorUserId: ctx.user.id,
    requestId: null,
    eventType: 'WALLET_CHALLENGE_ISSUED',
    metadata: { challengeId: challenge.challengeId, walletAddress: wallet },
  });

  return {
    challengeId: challenge.challengeId,
    walletAddress: wallet,
    message: challenge.message,
    expiresAt: new Date(challenge.expiresAtMs).toISOString(),
    instructions: [
      'Sign this exact message with MetaMask (personal_sign).',
      'Wallet binding is stored privately and never grants blockchain rights by itself.',
    ],
  };
}

/**
 * Verifies a wallet signature over a challenge message and, on success,
 * records the wallet binding:
 *  - message must hash to a stored unconsumed challenge,
 *  - signature must recover the challenge's wallet,
 *  - challenge must not be expired or already consumed (single-use),
 *  - the atomic `consumeChallenge` update wins the race.
 */
export async function verifyWalletOwnership(
  deps: ServiceDeps,
  ctx: AuthContext,
  input: { message: string; signature: string },
): Promise<WalletBindingDto> {
  const message = input.message?.trim() ?? '';
  const signature = input.signature?.trim() ?? '';
  if (message.length === 0 || signature.length === 0) {
    throw new ValidationError('Provide the signed message and signature from MetaMask.');
  }

  const messageHash = sha256Hex(message);
  const challenge = await findChallengeByMessageHash(deps.db, messageHash);
  if (!challenge || challenge.user_id !== ctx.user.id) {
    await writeAudit(deps.db, {
      actorUserId: ctx.user.id,
      requestId: null,
      eventType: 'WALLET_CHALLENGE_REJECTED',
      metadata: { reason: 'NO_MATCHING_CHALLENGE' },
    });
    throw new ValidationError('No outstanding wallet challenge matches this message. Request a new one.');
  }

  if (challenge.consumed_at !== null) {
    throw new ConflictError('This wallet challenge was already used. Request a new one.');
  }
  if (new Date(challenge.expires_at as string).getTime() <= Date.now()) {
    throw new ConflictError('This wallet challenge has expired. Request a new one.');
  }

  let recovered: string;
  try {
    recovered = verifyMessage(message, signature).toLowerCase();
  } catch {
    await writeAudit(deps.db, {
      actorUserId: ctx.user.id,
      requestId: null,
      eventType: 'WALLET_CHALLENGE_REJECTED',
      metadata: { reason: 'INVALID_SIGNATURE' },
    });
    throw new ValidationError('The signature is not valid for this message.');
  }

  if (recovered !== challenge.wallet_address.toLowerCase()) {
    await writeAudit(deps.db, {
      actorUserId: ctx.user.id,
      requestId: null,
      eventType: 'WALLET_CHALLENGE_REJECTED',
      metadata: { challengeId: challenge.id, reason: 'WALLET_MISMATCH' },
    });
    throw new ValidationError('Signature was made with a different wallet than requested.');
  }

  // Single-use + replay protection: exactly one caller flips consumed_at.
  const consumedNow = await consumeChallenge(deps.db, challenge.id);
  if (!consumedNow) {
    throw new ConflictError('This wallet challenge was already used. Request a new one.');
  }

  const hasOnChainRole = deps.chain
    ? await resolveOnChainRoleStatus(deps.chain, recovered)
    : 'NOT_APPLICABLE';

  try {
    const binding = await upsertWalletBinding(deps.db, {
      userId: ctx.user.id,
      walletAddress: recovered,
      chainId: deps.config.blockchain.chainId,
    });
    await writeAudit(deps.db, {
      actorUserId: ctx.user.id,
      requestId: null,
      eventType: 'WALLET_BOUND',
      metadata: { walletAddress: recovered, onChainVerifierRole: hasOnChainRole },
    });
    return toBindingDto(binding);
  } catch (error) {
    if (isUniqueViolation(error) || isCheckViolation(error)) {
      throw new ConflictError('This wallet is already bound to a different account.');
    }
    throw error;
  }
}

function toBindingDto(row: WalletBindingRow): WalletBindingDto {
  return {
    walletAddress: row.wallet_address,
    chainId: Number(row.chain_id),
    verifiedAt: toIso(row.verified_at),
  };
}

export async function getWalletStatus(deps: ServiceDeps, ctx: AuthContext): Promise<WalletStatusDto> {
  const binding = await findWalletBinding(deps.db, ctx.user.id);
  let roleStatus: RoleStatus = 'NOT_APPLICABLE';
  if (binding) {
    roleStatus = await resolveOnChainRoleStatus(deps.chain, binding.wallet_address);
  }
  return toStatusDto(binding, roleStatus);
}

export async function unbindWallet(deps: ServiceDeps, ctx: AuthContext): Promise<{ unbound: boolean }> {
  // Reviewers must first release the wallet anchor; an active verifier that is
  // mid-review loses the ability to anchor afterwards - that is intentional.
  const removed = await deleteWalletBinding(deps.db, ctx.user.id);
  if (removed) {
    await writeAudit(deps.db, {
      actorUserId: ctx.user.id,
      requestId: null,
      eventType: 'WALLET_UNBOUND',
      metadata: {},
    });
  }
  return { unbound: removed };
}

/** Service boundary used by request/anchor flows. */
export async function requireBoundWallet(
  deps: ServiceDeps,
  ctx: AuthContext,
): Promise<{ walletAddress: string }> {
  const binding = await findWalletBinding(deps.db, ctx.user.id);
  if (!binding) {
    throw new ForbiddenError(
      'Verify wallet ownership first: connect your wallet, sign the ownership challenge, then retry.',
    );
  }
  return { walletAddress: binding.wallet_address };
}
