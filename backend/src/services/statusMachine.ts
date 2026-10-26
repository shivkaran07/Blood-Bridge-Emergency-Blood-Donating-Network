import type { ResponseStatus, RequestStatus } from '../types/domain.js';
import { ConflictError } from '../lib/errors.js';

/**
 * The single source of truth for blood-request lifecycle transitions.
 * Every status change in the application goes through assertRequestTransition.
 *
 * Database-only verification produces VERIFIED. It never claims to be a
 * blockchain verification; Part 2 will add a separate on-chain confirmation.
 */
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'CANCELLED', 'EXPIRED'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  VERIFIED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'EXPIRED'],
  REJECTED: [],
  PARTIALLY_FULFILLED: ['FULFILLED', 'EXPIRED'],
  FULFILLED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export const CANCELLABLE_STATUSES: RequestStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED'];
export const COMPLETABLE_STATUSES: RequestStatus[] = ['VERIFIED', 'PARTIALLY_FULFILLED'];

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_TRANSITIONS[from].includes(to);
}

export function assertRequestTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(
      `A request in status ${from} cannot move to ${to}.`,
      { from, to, allowed: REQUEST_TRANSITIONS[from] },
    );
  }
}

export function isTerminalStatus(status: RequestStatus): boolean {
  return REQUEST_TRANSITIONS[status].length === 0;
}

/**
 * Response transitions. ACCEPTED does not fulfil a request and COMPLETED is an
 * application acknowledgement, not proof that a donation occurred.
 */
export const RESPONSE_TRANSITIONS: Record<ResponseStatus, ResponseStatus[]> = {
  OFFERED: ['ACCEPTED', 'DECLINED', 'WITHDRAWN', 'CANCELLED'],
  ACCEPTED: ['COMPLETED', 'WITHDRAWN', 'CANCELLED'],
  COMPLETED: [],
  DECLINED: [],
  WITHDRAWN: [],
  CANCELLED: [],
};

export function canResponseTransition(from: ResponseStatus, to: ResponseStatus): boolean {
  return RESPONSE_TRANSITIONS[from].includes(to);
}

export function assertResponseTransition(from: ResponseStatus, to: ResponseStatus): void {
  if (!canResponseTransition(from, to)) {
    throw new ConflictError(
      `A donor response in status ${from} cannot move to ${to}.`,
      { from, to, allowed: RESPONSE_TRANSITIONS[from] },
    );
  }
}
