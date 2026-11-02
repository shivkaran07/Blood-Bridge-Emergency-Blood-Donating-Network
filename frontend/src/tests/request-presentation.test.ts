import { describe, expect, it } from 'vitest';
import { deadlinePresentation } from '../lib/requestPresentation';
import { formatDateTime } from '../lib/format';
import type { BloodRequest, RequestStatus } from '../types/api';

const now = new Date('2026-11-02T12:00:00.000Z').getTime();

function request(status: RequestStatus, neededBy = '2026-11-02T18:00:00.000Z'): Pick<BloodRequest, 'status' | 'neededBy'> {
  return { status, neededBy };
}

describe('request deadline presentation', () => {
  it('shows an urgent tone for an open request due within a day', () => {
    const deadline = deadlinePresentation(request('VERIFIED'), now);
    expect(deadline.tone).toBe('urgent');
    expect(deadline.hint).toContain('Needed by');
    expect(deadline.mobileLabel).toMatch(/^Needed by /);
  });

  it('shows a normal tone for an open request due later', () => {
    const deadline = deadlinePresentation(request('VERIFIED', '2026-11-06T12:00:00.000Z'), now);
    expect(deadline.tone).toBe('normal');
  });

  it('does not present an active request with a past deadline as upcoming', () => {
    const deadline = deadlinePresentation(request('VERIFIED', '2026-11-01T12:00:00.000Z'), now);
    expect(deadline.tone).toBe('past');
    expect(deadline.label).toBe('Deadline passed');
  });

  it('distinguishes expired requests from open requests', () => {
    const deadline = deadlinePresentation(request('EXPIRED'), now);
    expect(deadline.tone).toBe('past');
    expect(deadline.mobileLabel).toContain('Expired');
    expect(deadline.hint).toContain('Deadline passed');
    expect(deadline.mobileLabel).toContain(formatDateTime('2026-11-02T18:00:00.000Z'));
  });

  it.each(['FULFILLED', 'CANCELLED', 'REJECTED'] as const)(
    'stops showing a countdown for a closed %s request',
    (status) => {
      const deadline = deadlinePresentation(
        request(status, '2026-11-05T12:00:00.000Z'),
        now,
      );
      expect(deadline.tone).toBe('closed');
      expect(deadline.mobileLabel).not.toContain('Needed');
    },
  );

  it('handles an invalid deadline without inventing a countdown', () => {
    const deadline = deadlinePresentation(request('VERIFIED', 'not-a-date'), now);
    expect(deadline.label).toBe('Deadline unavailable');
    expect(deadline.tone).toBe('normal');
  });
});
