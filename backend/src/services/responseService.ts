import type { AuthContext } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import { findDonorByUserId } from '../repositories/donorRepository.js';
import {
  findRequestById,
  findRequestForUpdate,
} from '../repositories/requestRepository.js';
import {
  findActiveResponse,
  findResponseById,
  findResponseForUpdate,
  insertResponse,
  listResponsesForDonor,
  listResponsesForRequest,
  updateResponseStatus,
} from '../repositories/responseRepository.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  isUniqueViolation,
} from '../lib/errors.js';
import { notifyUsers, writeAudit } from './notificationService.js';
import { toResponseDto, type DonorResponseDto } from './serializers.js';
import { assertResponseTransition } from './statusMachine.js';

export async function createDonorResponse(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
): Promise<DonorResponseDto> {
  const donor = await findDonorByUserId(deps.db, ctx.user.id);
  if (!donor) {
    throw new ForbiddenError('Create a donor profile before responding to requests.');
  }
  if (!donor.is_available) {
    throw new ConflictError('You are currently marked unavailable. Update your availability to respond.');
  }
  if (!donor.consent_to_contact) {
    throw new ForbiddenError(
      'Enable contact sharing after an accepted offer before responding to matched requests.',
    );
  }

  const responseId = await deps.db.transaction(async (tx) => {
    const request = await findRequestForUpdate(tx, requestId);
    if (!request) throw new NotFoundError('Blood request not found.');
    if (request.requester_id === ctx.user.id) {
      throw new ForbiddenError('You cannot respond to your own blood request.');
    }
    if (!['VERIFIED', 'PARTIALLY_FULFILLED'].includes(request.status)) {
      throw new ConflictError('Only verified, open requests can receive donor responses.');
    }
    if (new Date(request.needed_by).getTime() <= Date.now()) {
      throw new ConflictError('This request has reached its required-by time.');
    }
    if (request.blood_group !== donor.blood_group) {
      throw new UnprocessableError(
        'This prototype uses exact blood-group matching. Your recorded blood group does not match this request.',
      );
    }

    const existing = await findActiveResponse(tx, request.id, ctx.user.id);
    if (existing) {
      throw new ConflictError('You already have an active response for this request.');
    }

    let created;
    try {
      created = await insertResponse(tx, request.id, ctx.user.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('You already have an active response for this request.');
      }
      throw error;
    }

    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: request.id,
      eventType: 'DONOR_RESPONSE_CREATED',
      metadata: {
        responseStatus: 'OFFERED',
        bloodGroup: donor.blood_group,
        contactConsent: donor.consent_to_contact,
      },
    });
    await notifyUsers(tx, [request.requester_id], {
      type: 'DONOR_RESPONSE_RECEIVED',
      title: 'New donor response',
      message: 'A donor has offered to help with your blood request. Review the response in the application.',
      requestId: request.id,
    });

    return created.id;
  });

  const response = await findResponseById(deps.db, responseId);
  if (!response) throw new NotFoundError('Donor response not found.');
  return toResponseDto(response, ctx);
}

export async function listResponsesForOwnRequest(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
): Promise<DonorResponseDto[]> {
  const request = await findRequestById(deps.db, requestId);
  if (!request) throw new NotFoundError('Blood request not found.');

  const allowed =
    request.requester_id === ctx.user.id || ctx.isAdmin || ctx.isApprovedHospital;
  if (!allowed) throw new NotFoundError('Blood request not found.');

  const rows = await listResponsesForRequest(deps.db, request.id);
  return rows.map((row) => toResponseDto(row, ctx));
}

export async function listOwnResponses(
  deps: ServiceDeps,
  ctx: AuthContext,
  options: { limit: number; offset: number },
): Promise<DonorResponseDto[]> {
  const rows = await listResponsesForDonor(deps.db, ctx.user.id, options);
  return rows.map((row) => toResponseDto(row, ctx));
}

async function notifyRequestOwnerOfWithdrawal(
  deps: ServiceDeps,
  requestId: string,
  donorId: string,
  kind: 'withdraw' | 'decline',
): Promise<void> {
  const request = await findRequestById(deps.db, requestId);
  if (!request) return;
  if (request.requester_id === donorId) return;
  await notifyUsers(deps.db, [request.requester_id], {
    type: kind === 'withdraw' ? 'RESPONSE_WITHDRAWN' : 'DONOR_RESPONSE_DECLINED',
    title: kind === 'withdraw' ? 'Donor withdrew an offer' : 'Donor declined',
    message:
      kind === 'withdraw'
        ? 'A donor withdrew their response to your blood request.'
        : 'A donor declined their response to your blood request.',
    requestId: request.id,
  });
}

export async function decideOnResponse(
  deps: ServiceDeps,
  ctx: AuthContext,
  responseId: string,
  decision: 'ACCEPTED' | 'DECLINED',
): Promise<DonorResponseDto> {
  const initial = await findResponseById(deps.db, responseId);
  if (!initial) throw new NotFoundError('Donor response not found.');
  if (initial.requester_id !== ctx.user.id) {
    throw new ForbiddenError('Only the requester can accept or decline donor responses.');
  }

  await deps.db.transaction(async (tx) => {
    const request = await findRequestForUpdate(tx, initial.request_id);
    if (!request) throw new NotFoundError('Blood request not found.');
    if (!['VERIFIED', 'PARTIALLY_FULFILLED'].includes(request.status)) {
      throw new ConflictError('This request is not open for response decisions.');
    }

    const locked = await findResponseForUpdate(tx, responseId);
    if (!locked) throw new NotFoundError('Donor response not found.');
    if (locked.response_status !== 'OFFERED') {
      throw new ConflictError('Only an offered response can be accepted or declined.');
    }

    assertResponseTransition(locked.response_status, decision);
    const updated = await updateResponseStatus(tx, responseId, decision, ['OFFERED']);
    if (!updated) {
      throw new ConflictError('This response changed while you were reviewing it. Refresh and try again.');
    }

    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: request.id,
      eventType: decision === 'ACCEPTED' ? 'DONOR_RESPONSE_ACCEPTED' : 'DONOR_RESPONSE_DECLINED',
      metadata: { responseStatus: decision },
    });
    await notifyUsers(tx, [updated.donor_id], {
      type: decision === 'ACCEPTED' ? 'DONOR_RESPONSE_ACCEPTED' : 'DONOR_RESPONSE_DECLINED',
      title: decision === 'ACCEPTED' ? 'Your offer was accepted' : 'Your offer was declined',
      message:
        decision === 'ACCEPTED'
          ? 'The requester accepted your offer. Exchange contact details only if you consented, and follow hospital procedures.'
          : 'The requester declined this offer. Thank you for offering to help.',
      requestId: request.id,
    });
  });

  return getResponseForViewer(deps, ctx, responseId);
}

export async function declineOwnResponse(
  deps: ServiceDeps,
  ctx: AuthContext,
  responseId: string,
  kind: 'withdraw' | 'decline',
): Promise<DonorResponseDto> {
  const initial = await findResponseById(deps.db, responseId);
  if (!initial) throw new NotFoundError('Donor response not found.');
  if (initial.donor_id !== ctx.user.id) {
    throw new ForbiddenError('You can only change your own donor response.');
  }

  await deps.db.transaction(async (tx) => {
    const locked = await findResponseForUpdate(tx, responseId);
    if (!locked) throw new NotFoundError('Donor response not found.');
    if (!['OFFERED', 'ACCEPTED'].includes(locked.response_status)) {
      throw new ConflictError('This response can no longer be changed.');
    }

    const target = kind === 'withdraw' ? 'WITHDRAWN' : 'DECLINED';
    assertResponseTransition(locked.response_status, target);
    const updated = await updateResponseStatus(tx, responseId, target, ['OFFERED', 'ACCEPTED']);
    if (!updated) {
      throw new ConflictError('This response changed while you were updating it. Refresh and try again.');
    }

    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: updated.request_id,
      eventType: kind === 'withdraw' ? 'DONOR_RESPONSE_WITHDRAWN' : 'DONOR_RESPONSE_DECLINED',
      metadata: { responseStatus: target },
    });
  });

  await notifyRequestOwnerOfWithdrawal(deps, initial.request_id, ctx.user.id, kind);
  return getResponseForViewer(deps, ctx, responseId);
}

export async function markResponseCompleted(
  deps: ServiceDeps,
  ctx: AuthContext,
  responseId: string,
): Promise<DonorResponseDto> {
  const initial = await findResponseById(deps.db, responseId);
  if (!initial) throw new NotFoundError('Donor response not found.');
  if (initial.requester_id !== ctx.user.id && !ctx.isApprovedHospital) {
    throw new ForbiddenError('Only the requester or an approved hospital verifier can mark a response complete.');
  }

  await deps.db.transaction(async (tx) => {
    const locked = await findResponseForUpdate(tx, responseId);
    if (!locked) throw new NotFoundError('Donor response not found.');
    if (locked.response_status !== 'ACCEPTED') {
      throw new ConflictError('Only an accepted response can be marked complete.');
    }

    assertResponseTransition(locked.response_status, 'COMPLETED');
    const updated = await updateResponseStatus(tx, responseId, 'COMPLETED', ['ACCEPTED']);
    if (!updated) {
      throw new ConflictError('This response changed while you were updating it. Refresh and try again.');
    }

    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: updated.request_id,
      eventType: 'DONOR_RESPONSE_COMPLETED',
      metadata: { responseStatus: 'COMPLETED', medicalProof: false },
    });
    await notifyUsers(tx, [updated.donor_id], {
      type: 'RESPONSE_COMPLETED',
      title: 'Response marked complete',
      message: 'Your donor response was marked complete in the application. This is not a medical confirmation of donation.',
      requestId: updated.request_id,
    });
  });

  return getResponseForViewer(deps, ctx, responseId);
}

async function getResponseForViewer(
  deps: ServiceDeps,
  ctx: AuthContext,
  responseId: string,
): Promise<DonorResponseDto> {
  const row = await findResponseById(deps.db, responseId);
  if (!row) throw new NotFoundError('Donor response not found.');
  return toResponseDto(row, ctx);
}
