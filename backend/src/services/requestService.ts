import type { AuthContext, BloodGroup, RequestStatus } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import {
  countRequestFeed,
  countRequestsByRequester,
  findExpirableRequestIds,
  findLikelyDuplicate,
  findRequestById,
  findRequestForUpdate,
  insertRequest,
  insertRequestHistory,
  listRequestFeed,
  listRequestHistory,
  listRequestsByRequester,
  setRequestCancelled,
  setRequestCompletion,
  setRequestExpired,
  setRequestRejected,
  setRequestUnderReview,
  setRequestVerified,
  type CreateRequestInput,
} from '../repositories/requestRepository.js';
import { findDonorByUserId } from '../repositories/donorRepository.js';
import {
  findActiveResponse,
  listDonorActiveRequestIds,
  listDonorsWithActiveResponses,
  cancelActiveResponsesForRequest,
} from '../repositories/responseRepository.js';
import {
  blockchainTransactionCountForRequest,
  blockchainTransactionCountsForRequests,
} from '../repositories/blockchainRepository.js';
import { generateAuditKey } from '../lib/crypto.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  isUniqueViolation,
} from '../lib/errors.js';
import { toIso } from '../lib/serialize.js';
import {
  canManageRequest,
  canViewRequest,
  isRequestOwner,
} from './access.js';
import {
  notifyNewRequest,
  notifyUsers,
  writeAudit,
} from './notificationService.js';
import {
  toRequestDto,
  type BloodRequestDto,
} from './serializers.js';
import {
  assertRequestTransition,
  CANCELLABLE_STATUSES,
  COMPLETABLE_STATUSES,
} from './statusMachine.js';

export interface CreateRequestInputDto {
  bloodGroup: BloodGroup;
  unitsRequested: number;
  hospitalName: string;
  hospitalCity: string;
  hospitalArea: string;
  hospitalLatitude: number | null;
  hospitalLongitude: number | null;
  neededBy: string;
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  publicMessage: string | null;
  contactPhone: string;
  contactShareConsent: boolean;
  accuracyConfirmed: true;
}

export interface RequestListResult {
  items: BloodRequestDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface RequestHistoryDto {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actorUserId: string | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}

async function canRespondToRequest(
  deps: ServiceDeps,
  ctx: AuthContext,
  request: { id: string; requester_id: string; status: RequestStatus; blood_group: BloodGroup; needed_by: string | Date },
): Promise<boolean> {
  if (request.requester_id === ctx.user.id) return false;
  if (!['VERIFIED', 'PARTIALLY_FULFILLED'].includes(request.status)) return false;
  if (new Date(request.needed_by).getTime() <= Date.now()) return false;

  const donor = await findDonorByUserId(deps.db, ctx.user.id);
  if (!donor || !donor.is_available) return false;
  if (donor.blood_group !== request.blood_group) return false;

  const existing = await findActiveResponse(deps.db, request.id, ctx.user.id);
  return !existing;
}

async function detailDto(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
): Promise<BloodRequestDto> {
  const row = await findRequestById(deps.db, requestId);
  if (!row) throw new NotFoundError('Blood request not found.');
  if (!canViewRequest(ctx, row)) throw new NotFoundError('Blood request not found.');

  const transactionCount = await blockchainTransactionCountForRequest(deps.db, row.id);
  const activeResponse = await findActiveResponse(deps.db, row.id, ctx.user.id);
  const donor = await findDonorByUserId(deps.db, ctx.user.id);

  const acceptedResponse =
    activeResponse && ['ACCEPTED', 'COMPLETED'].includes(activeResponse.response_status);
  const includeRequesterContact =
    isRequestOwner(ctx, row) ||
    ctx.isApprovedHospital ||
    Boolean(acceptedResponse && row.contact_share_consent);

  const canRespond =
    Boolean(donor?.is_available) &&
    donor?.blood_group === row.blood_group &&
    !isRequestOwner(ctx, row) &&
    ['VERIFIED', 'PARTIALLY_FULFILLED'].includes(row.status) &&
    new Date(row.needed_by).getTime() > Date.now() &&
    !activeResponse;

  return toRequestDto(row, {
    viewer: ctx,
    includeRequesterContact,
    includeAuditKey: isRequestOwner(ctx, row) || ctx.isAdmin || ctx.isApprovedHospital,
    canRespond,
    transactionCount,
  });
}

/** Opportunistic expiry sweep; safe to call before reads and from a cron job. */
export async function expireStaleRequests(deps: ServiceDeps): Promise<number> {
  return deps.db.transaction(async (tx) => {
    const ids = await findExpirableRequestIds(tx, 100);
    if (ids.length === 0) return 0;

    for (const row of ids) {
      await setRequestExpired(tx, row.id);
      await insertRequestHistory(tx, {
        requestId: row.id,
        fromStatus: row.status,
        toStatus: 'EXPIRED',
        actorUserId: null,
        reason: 'The required-by time passed before completion.',
      });
      await writeAudit(tx, {
        actorUserId: null,
        requestId: row.id,
        eventType: 'REQUEST_EXPIRED',
        metadata: { previousStatus: row.status, system: true },
      });
      const cancelled = await cancelActiveResponsesForRequest(tx, row.id);
      await notifyUsers(tx, [row.requester_id], {
        type: 'REQUEST_EXPIRED',
        title: 'Blood request expired',
        message: 'Your blood request reached its required-by time and has expired. Submit a new request if blood is still needed.',
        requestId: row.id,
      });
      await notifyUsers(
        tx,
        cancelled.map((response) => response.donor_id),
        {
          type: 'REQUEST_EXPIRED',
          title: 'Request no longer active',
          message: 'A blood request you responded to has expired. Thank you for offering to help.',
          requestId: row.id,
        },
      );
    }
    return ids.length;
  });
}

export async function createBloodRequest(
  deps: ServiceDeps,
  ctx: AuthContext,
  input: CreateRequestInputDto,
): Promise<BloodRequestDto> {
  const neededBy = new Date(input.neededBy);
  if (Number.isNaN(neededBy.getTime()) || neededBy.getTime() < Date.now() + 5 * 60 * 1000) {
    throw new ConflictError('The required-by date must be at least five minutes in the future.');
  }
  if ((input.hospitalLatitude === null) !== (input.hospitalLongitude === null)) {
    throw new ConflictError('Provide both hospital coordinates, or neither.');
  }

  const requestId = await deps.db.transaction(async (tx) => {
    const duplicate = await findLikelyDuplicate(tx, {
      requesterId: ctx.user.id,
      bloodGroup: input.bloodGroup,
      hospitalName: input.hospitalName,
      neededBy: neededBy.toISOString(),
    });
    if (duplicate) {
      throw new ConflictError(
        'A likely duplicate active request already exists. Manage the existing request instead.',
        { existingRequestId: duplicate.id },
      );
    }

    const insert: CreateRequestInput = {
      requesterId: ctx.user.id,
      bloodGroup: input.bloodGroup,
      unitsRequested: input.unitsRequested,
      hospitalName: input.hospitalName,
      hospitalCity: input.hospitalCity,
      hospitalArea: input.hospitalArea,
      hospitalLatitude: input.hospitalLatitude,
      hospitalLongitude: input.hospitalLongitude,
      neededBy: neededBy.toISOString(),
      priority: input.priority,
      publicMessage: input.publicMessage,
      requesterContactPhone: input.contactPhone,
      contactShareConsent: input.contactShareConsent,
      blockchainAuditKey: generateAuditKey(),
    };

    let created;
    try {
      created = await insertRequest(tx, insert);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          'An active request with the same blood group, hospital and required-by time already exists.',
        );
      }
      throw error;
    }

    await insertRequestHistory(tx, {
      requestId: created.id,
      fromStatus: null,
      toStatus: 'SUBMITTED',
      actorUserId: ctx.user.id,
      reason: 'Request created by requester.',
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: created.id,
      eventType: 'REQUEST_CREATED',
      metadata: {
        bloodGroup: input.bloodGroup,
        unitsRequested: input.unitsRequested,
        priority: input.priority,
        blockchainSyncStatus: 'NOT_SCHEDULED',
      },
    });
    await notifyNewRequest(tx, {
      requestId: created.id,
      requesterId: ctx.user.id,
      bloodGroup: input.bloodGroup,
      unitsRequested: input.unitsRequested,
      hospitalName: input.hospitalName,
      hospitalCity: input.hospitalCity,
      priority: input.priority,
    });
    return created.id;
  });

  return detailDto(deps, ctx, requestId);
}

export async function getBloodRequest(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
): Promise<BloodRequestDto> {
  await expireStaleRequests(deps);
  return detailDto(deps, ctx, requestId);
}

export async function listMyRequests(
  deps: ServiceDeps,
  ctx: AuthContext,
  options: { status: RequestStatus | null; limit: number; offset: number },
): Promise<RequestListResult> {
  await expireStaleRequests(deps);
  const rows = await listRequestsByRequester(deps.db, ctx.user.id, options);
  const total = await countRequestsByRequester(deps.db, ctx.user.id, options.status);
  const txCounts = await blockchainTransactionCountsForRequests(
    deps.db,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) =>
      toRequestDto(row, {
        viewer: ctx,
        includeRequesterContact: true,
        includeAuditKey: true,
        canRespond: false,
        transactionCount: txCounts.get(row.id) ?? 0,
      }),
    ),
    total,
    limit: options.limit,
    offset: options.offset,
  };
}

/**
 * The donor-visible feed. A donor's own recorded blood group is enforced so
 * the feed remains relevant; an unprofiled user may browse verified requests.
 */
export async function listRequestFeedForViewer(
  deps: ServiceDeps,
  ctx: AuthContext,
  options: {
    bloodGroup: BloodGroup | null;
    city: string | null;
    limit: number;
    offset: number;
  },
): Promise<RequestListResult> {
  await expireStaleRequests(deps);

  const donor = await findDonorByUserId(deps.db, ctx.user.id);
  const effectiveBloodGroup = donor?.blood_group ?? options.bloodGroup;
  const feedOptions = { ...options, bloodGroup: effectiveBloodGroup };

  const rows = await listRequestFeed(deps.db, feedOptions);
  const total = await countRequestFeed(deps.db, {
    bloodGroup: effectiveBloodGroup,
    city: options.city,
  });
  const activeResponseIds = donor
    ? await listDonorActiveRequestIds(deps.db, ctx.user.id)
    : new Set<string>();
  const txCounts = await blockchainTransactionCountsForRequests(
    deps.db,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) =>
      toRequestDto(row, {
        viewer: ctx,
        includeRequesterContact: false,
        includeAuditKey: false,
        canRespond:
          Boolean(donor?.is_available) &&
          donor?.blood_group === row.blood_group &&
          row.requester_id !== ctx.user.id &&
          !activeResponseIds.has(row.id),
        transactionCount: txCounts.get(row.id) ?? 0,
      }),
    ),
    total,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function getRequestHistory(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
): Promise<RequestHistoryDto[]> {
  const request = await findRequestById(deps.db, requestId);
  if (!request) throw new NotFoundError('Blood request not found.');
  const allowed = isRequestOwner(ctx, request) || ctx.isAdmin || ctx.isApprovedHospital;
  if (!allowed) throw new NotFoundError('Blood request not found.');

  const rows = await listRequestHistory(deps.db, requestId);
  return rows.map((row) => ({
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    reason: row.reason,
    createdAt: toIso(row.created_at),
  }));
}

async function assertApprovedVerifier(ctx: AuthContext): Promise<void> {
  if (!ctx.isApprovedHospital) {
    throw new ForbiddenError('Only an approved hospital verifier can review blood requests.');
  }
}

async function lockLiveRequest(db: ServiceDeps['db'], id: string) {
  const row = await findRequestForUpdate(db, id);
  if (!row) throw new NotFoundError('Blood request not found.');
  if (new Date(row.needed_by).getTime() <= Date.now()) {
    throw new ConflictError('The required-by time for this request has passed.');
  }
  return row;
}

export async function claimRequestForReview(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
): Promise<BloodRequestDto> {
  await assertApprovedVerifier(ctx);

  await deps.db.transaction(async (tx) => {
    const request = await findRequestForUpdate(tx, requestId);
    if (!request) throw new NotFoundError('Blood request not found.');
    if (request.requester_id === ctx.user.id) {
      throw new ForbiddenError('You cannot review your own blood request.');
    }
    if (new Date(request.needed_by).getTime() <= Date.now()) {
      throw new ConflictError('The required-by time for this request has passed.');
    }
    if (request.status !== 'SUBMITTED') {
      throw new ConflictError('Only a submitted request can be claimed for review.');
    }
    assertRequestTransition(request.status, 'UNDER_REVIEW');
    await setRequestUnderReview(tx, request.id);
    await insertRequestHistory(tx, {
      requestId: request.id,
      fromStatus: request.status,
      toStatus: 'UNDER_REVIEW',
      actorUserId: ctx.user.id,
      reason: 'Hospital verifier started review.',
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: request.id,
      eventType: 'REQUEST_CLAIMED_FOR_REVIEW',
      metadata: { verificationMode: 'DATABASE' },
    });
    await notifyUsers(tx, [request.requester_id], {
      type: 'REQUEST_UNDER_REVIEW',
      title: 'Request under review',
      message: 'A hospital verifier has started reviewing your blood request.',
      requestId: request.id,
    });
  });

  return detailDto(deps, ctx, requestId);
}

export async function verifyRequest(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
  reason: string | null,
): Promise<BloodRequestDto> {
  await assertApprovedVerifier(ctx);

  await deps.db.transaction(async (tx) => {
    const request = await lockLiveRequest(tx, requestId);
    if (request.requester_id === ctx.user.id) {
      throw new ForbiddenError('You cannot verify your own blood request.');
    }

    let fromStatus = request.status;
    if (fromStatus === 'SUBMITTED') {
      assertRequestTransition(fromStatus, 'UNDER_REVIEW');
      await setRequestUnderReview(tx, request.id);
      await insertRequestHistory(tx, {
        requestId: request.id,
        fromStatus,
        toStatus: 'UNDER_REVIEW',
        actorUserId: ctx.user.id,
        reason: 'Automatically claimed for review.',
      });
      fromStatus = 'UNDER_REVIEW';
    }

    assertRequestTransition(fromStatus, 'VERIFIED');
    await setRequestVerified(tx, request.id, ctx.user.id, reason);
    await insertRequestHistory(tx, {
      requestId: request.id,
      fromStatus,
      toStatus: 'VERIFIED',
      actorUserId: ctx.user.id,
      reason: reason ?? 'Request verified by hospital reviewer.',
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: request.id,
      eventType: 'REQUEST_VERIFIED',
      metadata: {
        previousStatus: fromStatus,
        verificationMode: 'DATABASE',
        blockchainStatus: 'NOT_SCHEDULED',
      },
    });
    await notifyUsers(tx, [request.requester_id], {
      type: 'REQUEST_VERIFIED',
      title: 'Request verified',
      message:
        'A hospital verifier has verified your request in the application. This is a database-backed verification, not a blockchain verification. Donors can now see it.',
      requestId: request.id,
    });
  });

  return detailDto(deps, ctx, requestId);
}

export async function rejectRequest(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
  reason: string,
): Promise<BloodRequestDto> {
  await assertApprovedVerifier(ctx);
  if (reason.trim().length < 10) {
    throw new ConflictError('Provide a review reason of at least 10 characters.');
  }

  await deps.db.transaction(async (tx) => {
    const request = await lockLiveRequest(tx, requestId);
    if (request.requester_id === ctx.user.id) {
      throw new ForbiddenError('You cannot review your own blood request.');
    }

    let fromStatus = request.status;
    if (fromStatus === 'SUBMITTED') {
      assertRequestTransition(fromStatus, 'UNDER_REVIEW');
      await setRequestUnderReview(tx, request.id);
      await insertRequestHistory(tx, {
        requestId: request.id,
        fromStatus,
        toStatus: 'UNDER_REVIEW',
        actorUserId: ctx.user.id,
        reason: 'Automatically claimed for review.',
      });
      fromStatus = 'UNDER_REVIEW';
    }

    assertRequestTransition(fromStatus, 'REJECTED');
    await setRequestRejected(tx, request.id, ctx.user.id, reason);
    await insertRequestHistory(tx, {
      requestId: request.id,
      fromStatus,
      toStatus: 'REJECTED',
      actorUserId: ctx.user.id,
      reason,
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: request.id,
      eventType: 'REQUEST_REJECTED',
      metadata: { previousStatus: fromStatus, verificationMode: 'DATABASE' },
    });
    await notifyUsers(tx, [request.requester_id], {
      type: 'REQUEST_REJECTED',
      title: 'Request not verified',
      message: `A hospital verifier did not verify your request. Reason: ${reason}`,
      requestId: request.id,
    });
  });

  return detailDto(deps, ctx, requestId);
}

async function cancelInternal(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
  reason: string,
  adminAction: boolean,
): Promise<BloodRequestDto> {
  if (adminAction && !ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');

  await deps.db.transaction(async (tx) => {
    const request = await findRequestForUpdate(tx, requestId);
    if (!request) throw new NotFoundError('Blood request not found.');
    if (!adminAction && request.requester_id !== ctx.user.id) {
      throw new NotFoundError('Blood request not found.');
    }
    if (!CANCELLABLE_STATUSES.includes(request.status)) {
      throw new ConflictError('This request cannot be cancelled in its current status.');
    }
    if (new Date(request.needed_by).getTime() <= Date.now()) {
      throw new ConflictError('This request has reached its required-by time and cannot be cancelled.');
    }

    assertRequestTransition(request.status, 'CANCELLED');
    await setRequestCancelled(tx, request.id, reason);

    const cancelledResponses = await cancelActiveResponsesForRequest(tx, request.id);

    await insertRequestHistory(tx, {
      requestId: request.id,
      fromStatus: request.status,
      toStatus: 'CANCELLED',
      actorUserId: ctx.user.id,
      reason,
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: request.id,
      eventType: 'REQUEST_CANCELLED',
      metadata: { previousStatus: request.status, adminAction },
    });
    await notifyUsers(tx, [request.requester_id], {
      type: 'REQUEST_CANCELLED',
      title: 'Blood request cancelled',
      message: adminAction
        ? `An administrator cancelled your blood request. Reason: ${reason}`
        : 'Your blood request has been cancelled.',
      requestId: request.id,
    });
    await notifyUsers(
      tx,
      cancelledResponses.map((response) => response.donor_id),
      {
        type: 'REQUEST_CANCELLED',
        title: 'Request cancelled',
        message: 'A blood request you responded to has been cancelled. No further action is needed.',
        requestId: request.id,
      },
    );
  });

  return detailDto(deps, ctx, requestId);
}

export async function cancelBloodRequest(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
  reason: string,
): Promise<BloodRequestDto> {
  return cancelInternal(deps, ctx, requestId, reason, false);
}

export async function adminCancelBloodRequest(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
  reason: string,
): Promise<BloodRequestDto> {
  return cancelInternal(deps, ctx, requestId, reason, true);
}

export async function completeRequest(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
  status: 'PARTIALLY_FULFILLED' | 'FULFILLED',
  note: string | null,
): Promise<BloodRequestDto> {
  await deps.db.transaction(async (tx) => {
    const request = await lockLiveRequest(tx, requestId);
    if (request.requester_id !== ctx.user.id && !ctx.isAdmin) {
      throw new ForbiddenError('Only the requester or an administrator can record completion.');
    }
    if (!COMPLETABLE_STATUSES.includes(request.status)) {
      throw new ConflictError('This request cannot be marked complete in its current status.');
    }

    assertRequestTransition(request.status, status);
    await setRequestCompletion(tx, request.id, status);

    await insertRequestHistory(tx, {
      requestId: request.id,
      fromStatus: request.status,
      toStatus: status,
      actorUserId: ctx.user.id,
      reason: note ?? 'Completion recorded by requester.',
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: request.id,
      eventType: status === 'FULFILLED' ? 'REQUEST_FULFILLED' : 'REQUEST_PARTIALLY_FULFILLED',
      metadata: { previousStatus: request.status, noteProvided: Boolean(note) },
    });

    const responses = await listDonorsWithActiveResponses(tx, request.id);
    const donorIds = responses
      .filter((response) => ['ACCEPTED', 'COMPLETED'].includes(response.response_status))
      .map((response) => response.donor_id);

    await notifyUsers(tx, [request.requester_id], {
      type: status === 'FULFILLED' ? 'REQUEST_FULFILLED' : 'REQUEST_PARTIALLY_FULFILLED',
      title: status === 'FULFILLED' ? 'Request fulfilled' : 'Request partially fulfilled',
      message:
        'Your request status was updated. A donor response does not itself prove that blood was donated; follow hospital procedures.',
      requestId: request.id,
    });
    await notifyUsers(tx, donorIds, {
      type: status === 'FULFILLED' ? 'REQUEST_FULFILLED' : 'REQUEST_PARTIALLY_FULFILLED',
      title: 'Request status updated',
      message:
        'A request you responded to was marked complete by the requester in the application. This is not a medical confirmation of donation.',
      requestId: request.id,
    });
  });

  return detailDto(deps, ctx, requestId);
}
