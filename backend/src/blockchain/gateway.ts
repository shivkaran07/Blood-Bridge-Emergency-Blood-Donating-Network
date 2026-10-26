import type { VerificationAnchorInput, VerificationAnchorResult } from './types.js';
import { NotImplementedError } from '../lib/errors.js';

/**
 * Part 2 integration seam. The real gateway will use ethers.js + an authorized
 * signer/wallet, submit the anchor transaction to the BloodBridge contract,
 * poll for confirmation and record it in blockchain_transactions.
 *
 * Part 1 deliberately ships a disabled implementation. No transaction is ever
 * fabricated and database verification is never labelled as on-chain.
 */
export interface BlockchainGateway {
  isConfigured(): boolean;
  anchorVerification(input: VerificationAnchorInput): Promise<VerificationAnchorResult>;
}

export class DisabledBlockchainGateway implements BlockchainGateway {
  isConfigured(): boolean {
    return false;
  }

  async anchorVerification(_input: VerificationAnchorInput): Promise<VerificationAnchorResult> {
    throw new NotImplementedError(
      'Blockchain anchoring is not implemented in Part 1. No transaction was submitted.',
    );
  }
}
