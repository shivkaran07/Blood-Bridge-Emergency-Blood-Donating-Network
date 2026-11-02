import { useQuery } from '@tanstack/react-query';
import { useAuthToken } from '../context/AuthContext';
import { api } from './api';
import { queryKeys } from './queryClient';
import type { BlockchainStatus } from '../types/api';

export type VerificationTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface VerificationPresentation {
  /** Short label suitable for a header pill. */
  label: string;
  /** Human-readable mode name. */
  title: string;
  /** Explanation that distinguishes database verification from chain anchoring. */
  detail: string;
  tone: VerificationTone;
  onChain: boolean;
  operational: boolean;
  syncIssueCount: number;
}

/**
 * Single shared source of truth for verification state. Both the application
 * header and the Verification & audit page read the same backend response, so
 * the UI cannot invent a second, conflicting network status.
 */
export function useVerificationStatus(throwOnError = false) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.blockchain,
    queryFn: ({ signal }) => api.blockchainStatus(token, signal),
    staleTime: 60_000,
    retry: 1,
    throwOnError,
  });
}

export function describeVerification(
  data: BlockchainStatus | undefined,
  hasError = false,
): VerificationPresentation {
  if (hasError || !data) {
    return {
      label: 'Status unknown',
      title: 'Verification status unavailable',
      detail:
        'The backend status could not be read. This is unknown, not proof that on-chain anchoring is active.',
      tone: hasError ? 'warning' : 'neutral',
      onChain: false,
      operational: false,
      syncIssueCount: 0,
    };
  }

  const onChain = data.verificationMode === 'ON_CHAIN';
  const operational = onChain && data.connected && data.operational;
  const syncIssueCount =
    (data.syncCounts.FAILED ?? 0) + (data.syncCounts.NEEDS_RECONCILIATION ?? 0);

  if (!onChain) {
    return {
      label: 'Database mode',
      title: 'Database-backed verification',
      detail:
        'Hospital review decisions are recorded in the application database. On-chain audit anchoring is not active in this deployment.',
      tone: 'neutral',
      onChain,
      operational: false,
      syncIssueCount,
    };
  }

  if (!data.connected) {
    return {
      label: 'Network unavailable',
      title: 'On-chain mode configured, chain unreachable',
      detail:
        'The backend is configured for on-chain anchoring, but it cannot reach the chain right now. Pending operations may need reconciliation.',
      tone: 'warning',
      onChain,
      operational,
      syncIssueCount,
    };
  }

  if (!data.operational) {
    return {
      label: 'Contract unavailable',
      title: 'Chain reachable, contract not operational',
      detail:
        'The chain responds, but the configured contract is not available for anchoring. A configured address alone is not proof of a working integration.',
      tone: 'warning',
      onChain,
      operational,
      syncIssueCount,
    };
  }

  return {
    label: 'Anchoring active',
    title: 'Wallet-signed audit anchoring',
    detail:
      'Confirmed anchor transactions are submitted by an authorized wallet and verified by the backend. An anchor records a decision; it never proves medical facts.',
    tone: 'success',
    onChain,
    operational,
    syncIssueCount,
  };
}
