import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RequestCard } from '../components/requests/RequestCard';
import type { BloodRequest, RequestStatus } from '../types/api';

function makeRequest(overrides: Partial<BloodRequest> = {}): BloodRequest {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    requesterId: '22222222-2222-4222-8222-222222222222',
    requesterName: 'Test Requester',
    requesterContactPhone: '+910000000000',
    contactShareConsent: false,
    bloodGroup: 'O-',
    unitsRequested: 2,
    hospitalName: 'City General Hospital',
    hospitalCity: 'Pune',
    hospitalArea: 'Central district',
    neededBy: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    priority: 'CRITICAL',
    publicMessage: 'Synthetic test request for the prototype.',
    status: 'SUBMITTED',
    cancellationReason: null,
    cancelledAt: null,
    reviewedAt: null,
    reviewReason: null,
    blockchainAuditKey: 'audit_reference_not_a_transaction',
    blockchainSyncStatus: 'NOT_SCHEDULED',
    responseCount: 0,
    acceptedResponseCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isOwner: false,
    permissions: {
      canCancel: false,
      canComplete: false,
      canVerify: false,
      canRespond: false,
      canViewResponses: false,
      canViewMatches: false,
      canViewRequesterContact: false,
    },
    verification: {
      mode: 'DATABASE',
      blockchainStatus: 'NOT_SCHEDULED',
      blockchainVerified: false,
      transactionCount: 0,
      note: 'Database-backed verification only.',
    },
    ...overrides,
  };
}

function renderCard(status: RequestStatus) {
  return render(
    <MemoryRouter>
      <RequestCard request={makeRequest({ status })} />
    </MemoryRouter>,
  );
}

describe('RequestCard verification wording', () => {
  it('shows an awaiting-review state for a submitted request', () => {
    renderCard('SUBMITTED');
    expect(screen.getByText('Awaiting hospital review')).toBeInTheDocument();
    expect(screen.queryByText(/Database verified/i)).not.toBeInTheDocument();
  });

  it('labels a verified request as database-verified and not on-chain', () => {
    renderCard('VERIFIED');
    expect(screen.getByText('Database verified — not on-chain')).toBeInTheDocument();
    expect(screen.queryByText(/blockchain verified/i)).not.toBeInTheDocument();
  });

  it('does not show verification for a rejected request', () => {
    renderCard('REJECTED');
    expect(screen.getByText('Verification rejected')).toBeInTheDocument();
    expect(screen.queryByText(/Database verified/i)).not.toBeInTheDocument();
  });

  it('never renders the private requester phone number', () => {
    renderCard('VERIFIED');
    expect(screen.queryByText('+910000000000')).not.toBeInTheDocument();
  });

  it('shows the blood group and hospital location', () => {
    renderCard('VERIFIED');
    expect(screen.getAllByText(/O-/).length).toBeGreaterThan(0);
    expect(screen.getByText('City General Hospital')).toBeInTheDocument();
    expect(screen.getByText('Central district, Pune')).toBeInTheDocument();
  });
});
