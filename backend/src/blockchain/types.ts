import type { OnChainStatus } from './adapter.js';

/**
 * The operation record handed to the frontend for wallet signing. The wallet
 * signs and submits the transaction; the backend then confirms it
 * independently via the ChainAdapter.
 */
export interface AnchorOperationDto {
  operationId: string;
  requestId: string;
  auditKey: string;
  action: 'VERIFY_REQUEST' | 'REJECT_REQUEST' | 'FULFILL_REQUEST';
  functionName: 'recordVerifiedRequest' | 'recordRejectedRequest' | 'recordTerminalStatus';
  /** Encoded call arguments for the contract function. */
  args: string[];
  contractAddress: string;
  chainId: number;
  networkName: string;
  /** From address the wallet MUST submit the transaction with. */
  expectedFromAddress: string;
  /** Contract status this operation must produce. */
  expectedStatus: OnChainStatus;
  createdAt: string;
}

export interface VerificationAnchorInput {
  requestId: string;
  blockchainAuditKey: string;
  actorUserId: string;
  action: 'VERIFY_REQUEST' | 'REJECT_REQUEST' | 'FULFILL_REQUEST';
}
