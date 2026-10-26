import type { AuthContext, BloodRequestRow } from '../types/domain.js';

export function isRequestOwner(ctx: AuthContext, request: Pick<BloodRequestRow, 'requester_id'>): boolean {
  return request.requester_id === ctx.user.id;
}

/** Owner, administrators and approved hospital verifiers can manage a request. */
export function canManageRequest(
  ctx: AuthContext,
  request: Pick<BloodRequestRow, 'requester_id'>,
): boolean {
  return isRequestOwner(ctx, request) || ctx.isAdmin || ctx.isApprovedHospital;
}

/**
 * Verified and partially fulfilled requests form the donor-visible feed.
 * Everything else is limited to the owner, administrators and approved
 * hospital verifiers.
 */
export function canViewRequest(
  ctx: AuthContext,
  request: Pick<BloodRequestRow, 'requester_id' | 'status'>,
): boolean {
  if (canManageRequest(ctx, request)) return true;
  return request.status === 'VERIFIED' || request.status === 'PARTIALLY_FULFILLED';
}
