import type { BrowserProvider, Eip1193Provider } from 'ethers';
import { api } from '../api';
import { BLOODBRIDGE_ABI } from './bloodbridgeAbi';
import type { AnchorOperation, RequestDecisionResult } from '../../types/api';

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}

async function connectedWallet(
  token: string,
  expectedChainId?: number,
  networkName?: string,
): Promise<{ provider: BrowserProvider; address: string }> {
  if (!window.ethereum) throw new Error('MetaMask was not detected. Install MetaMask and retry.');
  const { BrowserProvider } = await import('ethers');
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  if (expectedChainId !== undefined) {
    const chainId = Number((await provider.getNetwork()).chainId);
    if (chainId !== expectedChainId) {
      throw new Error(`Wrong wallet network (chain ${chainId}). Switch MetaMask to ${networkName ?? 'the configured network'} (chain ${expectedChainId}) and retry.`);
    }
  }
  const wallet = await api.walletStatus(token);
  if (wallet.bound && wallet.walletAddress?.toLowerCase() !== address.toLowerCase()) {
    throw new Error('The connected MetaMask account differs from your verified wallet. Switch accounts or update your wallet binding.');
  }
  if (!wallet.bound) {
    const challenge = await api.walletChallenge(token, address);
    const signature = await signer.signMessage(challenge.message);
    await api.verifyWallet(token, challenge.message, signature);
  }
  return { provider, address: address.toLowerCase() };
}

export async function submitPreparedAnchor(
  token: string,
  operation: AnchorOperation,
): Promise<void> {
  const { provider, address } = await connectedWallet(token);
  if (address !== operation.expectedFromAddress.toLowerCase()) {
    throw new Error('Connected wallet does not match the verified wallet for this operation.');
  }
  const chainId = Number((await provider.getNetwork()).chainId);
  if (chainId !== operation.chainId) {
    throw new Error(`Wrong wallet network (chain ${chainId}). Switch MetaMask to ${operation.networkName} (chain ${operation.chainId}) and retry.`);
  }

  const signer = await provider.getSigner();
  const { Contract } = await import('ethers');
  const abi = BLOODBRIDGE_ABI as unknown as ConstructorParameters<typeof Contract>[1];
  const contract = new Contract(operation.contractAddress, abi, signer);
  let transaction;
  try {
    transaction = await contract.getFunction(operation.functionName)(...operation.args);
  } catch (error) {
    const providerError = error as { code?: number; shortMessage?: string; message?: string };
    if (providerError.code === 4001) throw new Error('Transaction was rejected in MetaMask. No confirmation was recorded.');
    throw new Error(providerError.shortMessage ?? providerError.message ?? 'MetaMask could not submit the contract transaction.');
  }

  // Persist the hash immediately. The backend waits for confirmations and
  // independently validates the receipt, event and contract state.
  const result = await api.confirmAnchor(token, operation.operationId, transaction.hash);
  if (result.status !== 'CONFIRMED') {
    if (result.status === 'FAILED') {
      throw new Error(`The blockchain transaction ${transaction.hash} failed validation. The request decision was not applied; review the audit state before trying a new decision.`);
    }
    throw new Error(`Transaction ${transaction.hash} is still pending and was saved for reconciliation. Check the verification & audit page before retrying.`);
  }
}

export async function performRequestDecision(
  token: string,
  requestId: string,
  decision: { type: 'verify'; reason: string } | { type: 'reject'; reason: string } | { type: 'complete' },
): Promise<RequestDecisionResult> {
  const mode = await api.blockchainStatus(token);
  if (mode.verificationMode === 'ON_CHAIN') {
    await connectedWallet(token, mode.chainId, mode.networkName);
  }

  let result: RequestDecisionResult;
  try {
    result = decision.type === 'verify'
      ? await api.verifyRequest(token, requestId, decision.reason || null)
      : decision.type === 'reject'
        ? await api.rejectRequest(token, requestId, decision.reason)
        : await api.prepareChainCompletion(token, requestId);
  } catch (error) {
    // Recover an operation prepared before the user closed/rejected MetaMask,
    // or reconcile the same hash after an RPC timeout. Never create a second
    // contract transaction for an already-submitted operation.
    const operations = await api.blockchainOperations(token, requestId).catch(() => null);
    const wantedAction = decision.type === 'complete'
      ? 'FULFILL_REQUEST'
      : decision.type === 'verify' ? 'VERIFY_REQUEST' : 'REJECT_REQUEST';
    const pending = operations?.items.find((item) =>
      item.action === wantedAction && ['PENDING', 'SUBMITTED', 'NEEDS_RECONCILIATION'].includes(item.status),
    );
    if (!pending) throw error;
    if (pending.status !== 'PENDING') {
      const repaired = await api.reconcileAnchor(token, pending.id);
      if (repaired.status === 'CONFIRMED') {
        return { mode: 'ON_CHAIN', operation: operationFromRow(pending), request: repaired.request };
      }
      throw new Error(`The existing transaction remains ${repaired.status.toLowerCase()}. Review the audit page before retrying.`);
    }
    const binding = await api.walletStatus(token);
    if (!binding.walletAddress) throw new Error('No verified wallet is associated with this account. Connect and verify a wallet first.');
    const operation = operationFromRow(pending, binding.walletAddress);
    await submitPreparedAnchor(token, operation);
    return { mode: 'ON_CHAIN', operation, request: (await api.request(token, requestId)) };
  }

  if (result.mode === 'ON_CHAIN') await submitPreparedAnchor(token, result.operation);
  return result;
}

function operationFromRow(
  row: import('../../types/api').BlockchainOperationRow,
  walletAddress = '',
): AnchorOperation {
  return {
    operationId: row.id,
    requestId: row.requestId,
    auditKey: row.auditKey,
    action: row.action,
    functionName: row.functionName,
    args: row.action === 'FULFILL_REQUEST' ? [`0x${row.auditKey}`, '4'] : [`0x${row.auditKey}`],
    contractAddress: row.contractAddress,
    chainId: row.chainId,
    networkName: row.networkName,
    expectedFromAddress: walletAddress,
    expectedStatus: row.action === 'VERIFY_REQUEST' ? 'VERIFIED' : row.action === 'REJECT_REQUEST' ? 'REJECTED' : 'COMPLETED',
    createdAt: new Date().toISOString(),
  };
}
