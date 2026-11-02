import type { VerificationMode } from '../config/env.js';

/**
 * On-chain states mirrored from contracts/BloodBridge.sol.
 * NONE means "no record for this audit key".
 */
export type OnChainStatus = 'NONE' | 'VERIFIED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface ChainHealth {
  connected: boolean;
  chainId: number | null;
  latestBlock: number | null;
  error: string | null;
}

/** What the wallet's transaction was supposed to do. */
export interface AnchorExpectation {
  /** 64-character lowercase hex audit key (becomes bytes32 on chain). */
  auditKey: string;
  /** Contract-side status the event must report. */
  expectedToStatus: OnChainStatus;
  /** The bound wallet that must have signed and sent the transaction. */
  expectedFrom: string;
  /** The configured BloodBridge contract. */
  contractAddress: string;
}

export interface AnchorVerificationSuccess {
  ok: true;
  transactionHash: string;
  chainId: number;
  contractAddress: string;
  blockNumber: number;
  /** Actual wallet that signed the transaction (lowercased). */
  fromAddress: string;
  /** Actual `to` of the transaction (lowercased). */
  toAddress: string;
  contractStatus: OnChainStatus;
  eventStatus: OnChainStatus;
  eventActor: string;
  eventBlockTimestampSeconds: number;
}

export type AnchorVerificationFailure = {
  ok: false;
  reason:
    | 'CHAIN_MISMATCH'
    | 'RECEIPT_NOT_FOUND'
    | 'RECEIPT_TIMEOUT'
    | 'TX_REVERTED'
    | 'RECIPIENT_MISMATCH'
    | 'SENDER_MISMATCH'
    | 'EVENT_MISMATCH'
    | 'CONTRACT_STATE_MISMATCH'
    | 'RPC_ERROR';
  message: string;
  /** True when a later reconcile pass may still find the tx on chain. */
  retryable: boolean;
};

export type AnchorVerification = AnchorVerificationSuccess | AnchorVerificationFailure;

/**
 * The backend's independent view of the chain. It NEVER signs transactions:
 * verifier transactions are wallet signed; the backend only reads receipts,
 * events and contract state to validate what happened.
 */
export interface ChainAdapter {
  readonly verificationMode: 'ON_CHAIN';
  contractAddress(): string | null;
  getHealth(): Promise<ChainHealth>;
  /** True when `address` holds VERIFIER_ROLE on the configured contract. */
  isVerifier(address: string): Promise<boolean>;
  /** Current on-chain status of an audit key (NONE = unknown key). */
  getOnChainStatus(auditKey: string): Promise<OnChainStatus>;
  /**
   * Confirms a wallet-submitted transaction against the expectation:
   * receipt lookup, status, recipient, sender, emitted event, and the live
   * contract state - every rule checked independently of the frontend.
   */
  verifyAnchorTx(
    transactionHash: string,
    expectation: AnchorExpectation,
  ): Promise<AnchorVerification>;
}

/** Helper shared by adapters and tests. */
export function auditKeyToBytes32(auditKey: string): string {
  if (!/^[a-f0-9]{64}$/.test(auditKey)) {
    throw new Error('Audit key must be 64 hex characters.');
  }
  return `0x${auditKey}`;
}

export const EXPECTED_CHAIN_STATUS_FOR_ACTION: Record<
  'VERIFY_REQUEST' | 'REJECT_REQUEST' | 'FULFILL_REQUEST',
  OnChainStatus
> = {
  VERIFY_REQUEST: 'VERIFIED',
  REJECT_REQUEST: 'REJECTED',
  FULFILL_REQUEST: 'COMPLETED',
};

export type { VerificationMode };
