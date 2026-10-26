import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BlockchainStatusBadge,
  RequestStatusBadge,
  VerificationTag,
} from '../components/ui/Badge';
import { REQUEST_STATUSES, type RequestStatus } from '../types/api';
import { requestStatusLabels } from '../lib/constants';

describe('request status rendering', () => {
  it.each(REQUEST_STATUSES)('renders the expected label for %s', (status) => {
    render(<RequestStatusBadge status={status} />);
    expect(screen.getByText(requestStatusLabels[status])).toBeInTheDocument();
  });
});

describe('verification wording', () => {
  it('never promotes an unreviewed request to verified', () => {
    render(<VerificationTag status="SUBMITTED" blockchainStatus="NOT_SCHEDULED" />);
    expect(screen.getByText('Awaiting hospital review')).toBeInTheDocument();
    expect(screen.queryByText(/database verified/i)).not.toBeInTheDocument();
  });

  it('labels database verification and denies an on-chain anchor', () => {
    render(<VerificationTag status="VERIFIED" blockchainStatus="NOT_SCHEDULED" />);
    expect(screen.getByText('Database verified')).toBeInTheDocument();
    expect(screen.getByText('No on-chain anchor')).toBeInTheDocument();
    expect(screen.queryByText(/blockchain verified/i)).not.toBeInTheDocument();
  });

  it('does not claim database verification when a request was rejected', () => {
    render(<VerificationTag status="REJECTED" blockchainStatus="NOT_SCHEDULED" />);
    expect(screen.getByText('Verification rejected')).toBeInTheDocument();
    expect(screen.queryByText('Database verified')).not.toBeInTheDocument();
  });

  it('shows prepared synchronization states honestly', () => {
    render(<BlockchainStatusBadge status="NOT_SCHEDULED" />);
    expect(screen.getByText('Not scheduled')).toBeInTheDocument();
    render(<BlockchainStatusBadge status="AWAITING_WALLET" />);
    expect(screen.getByText('Awaiting wallet')).toBeInTheDocument();
  });

  it('covers every supported request status', () => {
    const supported: RequestStatus[] = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'VERIFIED',
      'REJECTED',
      'PARTIALLY_FULFILLED',
      'FULFILLED',
      'CANCELLED',
      'EXPIRED',
    ];
    expect([...REQUEST_STATUSES]).toEqual(supported);
  });
});
