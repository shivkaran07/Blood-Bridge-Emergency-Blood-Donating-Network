export interface VerificationAnchorInput {
  requestId: string;
  blockchainAuditKey: string;
  actorUserId: string;
  action: 'VERIFY_REQUEST' | 'REJECT_REQUEST' | 'FULFILL_REQUEST';
}

export interface VerificationAnchorResult {
  transactionHash: string;
  networkName: string;
  chainId: number;
  contractAddress: string;
  status: 'SUBMITTED';
}
