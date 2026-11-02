import { describe, expect, it } from 'vitest';
import { describeVerification } from '../lib/verificationStatus';
import type { BlockchainStatus } from '../types/api';

const baseStatus: BlockchainStatus = {
  phase: 'test',
  prepared: true,
  connected: false,
  operational: false,
  enabledByConfiguration: false,
  contractAddressConfigured: false,
  networkName: 'hardhat-local',
  chainId: 31337,
  verificationMode: 'DATABASE',
  syncCounts: {
    NOT_SCHEDULED: 0,
    AWAITING_WALLET: 0,
    SUBMITTED: 0,
    CONFIRMED: 0,
    FAILED: 0,
    NEEDS_RECONCILIATION: 0,
  },
  pendingAnchors: 0,
  transactionsRecorded: 0,
  recentTransactions: [],
  explanation: 'Database mode.',
  nextPhase: 'None',
};

describe('shared verification presentation', () => {
  it('reports database mode without claiming a verified network', () => {
    const presentation = describeVerification(baseStatus);
    expect(presentation.label).toBe('Database mode');
    expect(presentation.onChain).toBe(false);
    expect(presentation.operational).toBe(false);
    expect(presentation.label).not.toMatch(/verified network/i);
  });

  it('treats an unreadable status as unknown rather than active', () => {
    const presentation = describeVerification(undefined, true);
    expect(presentation.label).toBe('Status unknown');
    expect(presentation.tone).toBe('warning');
    expect(presentation.detail).toMatch(/not proof/i);
  });

  it('warns when on-chain mode cannot reach the chain', () => {
    const presentation = describeVerification({
      ...baseStatus,
      verificationMode: 'ON_CHAIN',
      connected: false,
    });
    expect(presentation.label).toBe('Network unavailable');
    expect(presentation.tone).toBe('warning');
    expect(presentation.onChain).toBe(true);
  });

  it('does not call a reachable chain operational without a working contract', () => {
    const presentation = describeVerification({
      ...baseStatus,
      verificationMode: 'ON_CHAIN',
      connected: true,
      operational: false,
    });
    expect(presentation.label).toBe('Contract unavailable');
    expect(presentation.tone).toBe('warning');
    expect(presentation.operational).toBe(false);
  });

  it('only reports active anchoring when the backend says it is operational', () => {
    const presentation = describeVerification({
      ...baseStatus,
      verificationMode: 'ON_CHAIN',
      connected: true,
      operational: true,
    });
    expect(presentation.label).toBe('Anchoring active');
    expect(presentation.tone).toBe('success');
    expect(presentation.operational).toBe(true);
  });

  it('counts failed and reconciliation sync issues honestly', () => {
    const presentation = describeVerification({
      ...baseStatus,
      syncCounts: {
        ...baseStatus.syncCounts,
        FAILED: 2,
        NEEDS_RECONCILIATION: 1,
      },
    });
    expect(presentation.syncIssueCount).toBe(3);
  });
});
