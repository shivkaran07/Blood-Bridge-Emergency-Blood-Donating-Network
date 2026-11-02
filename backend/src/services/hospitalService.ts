import type { AuthContext } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import {
  countHospitalApplications,
  findHospitalById,
  findHospitalByUserId,
  createOrResubmitHospitalApplication,
  decideHospitalApplication,
  listHospitalApplications,
  type HospitalApplicationInput,
} from '../repositories/hospitalRepository.js';
import { countHospitalQueue, listHospitalQueue } from '../repositories/requestRepository.js';
import {
  listHospitalAuditEvents,
  hospitalAuditSummary,
} from '../repositories/auditRepository.js';
import { grantRole, revokeRole } from '../repositories/userRepository.js';
import {
  blockchainTransactionCountsForRequests,
} from '../repositories/blockchainRepository.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  isUniqueViolation,
} from '../lib/errors.js';
import { expireStaleRequests } from './requestService.js';
import { notifyAdmins, notifyUsers, writeAudit } from './notificationService.js';
import {
  toAuditDto,
  toHospitalApplicationDto,
  toHospitalProfileDto,
  toRequestDto,
  type AuditEventDto,
  type BloodRequestDto,
  type HospitalApplicationDto,
  type HospitalProfileDto,
} from './serializers.js';

export async function applyForHospitalVerification(
  deps: ServiceDeps,
  ctx: AuthContext,
  input: HospitalApplicationInput,
): Promise<HospitalProfileDto> {
  const existing = await findHospitalByUserId(deps.db, ctx.user.id);
  if (existing?.verification_status === 'PENDING') {
    throw new ConflictError('You already have a hospital application awaiting review.');
  }
  if (existing?.verification_status === 'APPROVED') {
    throw new ConflictError('This account is already an approved hospital verifier.');
  }

  try {
    const application = await deps.db.transaction(async (tx) => {
      const created = await createOrResubmitHospitalApplication(tx, ctx.user.id, input);
      if (!created) {
        throw new ConflictError('A hospital application already exists for this account.');
      }

      await writeAudit(tx, {
        actorUserId: ctx.user.id,
        requestId: null,
        eventType: 'HOSPITAL_APPLICATION_SUBMITTED',
        metadata: {
          hospitalProfileId: created.id,
          hospitalName: created.hospital_name,
          resubmission: Boolean(existing),
        },
      });
      await notifyAdmins(tx, {
        type: 'HOSPITAL_APPLICATION_SUBMITTED',
        title: 'Hospital verification application',
        message: `${created.hospital_name}, ${created.city} submitted a verification application for review.`,
        requestId: null,
      });
      return created;
    });

    return toHospitalProfileDto(application);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        'A hospital application with this registration number already exists.',
      );
    }
    throw error;
  }
}

export async function getMyHospitalApplication(
  deps: ServiceDeps,
  ctx: AuthContext,
): Promise<HospitalProfileDto> {
  const application = await findHospitalByUserId(deps.db, ctx.user.id);
  if (!application) throw new NotFoundError('No hospital application was found for this account.');
  return toHospitalProfileDto(application);
}

async function requireApprovedVerifier(ctx: AuthContext): Promise<void> {
  if (!ctx.isApprovedHospital) {
    throw new ForbiddenError('Only an approved hospital verifier can access this workflow.');
  }
}

export interface HospitalQueueResult {
  items: BloodRequestDto[];
  total: number;
  limit: number;
  offset: number;
}

export async function getVerificationQueue(
  deps: ServiceDeps,
  ctx: AuthContext,
  options: { limit: number; offset: number },
): Promise<HospitalQueueResult> {
  await requireApprovedVerifier(ctx);
  await expireStaleRequests(deps);

  const rows = await listHospitalQueue(deps.db, options);
  const total = await countHospitalQueue(deps.db);
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

export interface HospitalDashboardDto {
  pendingReviews: number;
  verifiedByMe: number;
  rejectedByMe: number;
  recentlyReviewed: number;
  queuePreview: BloodRequestDto[];
  recentAudit: AuditEventDto[];
  hospital: HospitalProfileDto;
}

export async function getHospitalDashboard(
  deps: ServiceDeps,
  ctx: AuthContext,
): Promise<HospitalDashboardDto> {
  await requireApprovedVerifier(ctx);
  const hospital = await findHospitalByUserId(deps.db, ctx.user.id);
  if (!hospital) throw new NotFoundError('Hospital profile not found.');

  await expireStaleRequests(deps);
  const queue = await getVerificationQueue(deps, ctx, { limit: 5, offset: 0 });
  const summary = await hospitalAuditSummary(deps.db, ctx.user.id);
  const audit = await listHospitalAuditEvents(deps.db, ctx.user.id, { limit: 5, offset: 0 });

  return {
    pendingReviews: queue.total,
    verifiedByMe: summary.verified,
    rejectedByMe: summary.rejected,
    recentlyReviewed: summary.verified + summary.rejected,
    queuePreview: queue.items,
    recentAudit: audit.map(toAuditDto),
    hospital: toHospitalProfileDto(hospital),
  };
}

export async function getHospitalAudit(
  deps: ServiceDeps,
  ctx: AuthContext,
  options: { limit: number; offset: number },
): Promise<{ items: AuditEventDto[]; summary: { verified: number; rejected: number } }> {
  await requireApprovedVerifier(ctx);
  const rows = await listHospitalAuditEvents(deps.db, ctx.user.id, options);
  const summary = await hospitalAuditSummary(deps.db, ctx.user.id);
  return { items: rows.map(toAuditDto), summary };
}

export interface HospitalApplicationPage {
  items: HospitalApplicationDto[];
  total: number;
}

export async function listApplicationsForAdmin(
  deps: ServiceDeps,
  ctx: AuthContext,
  options: {
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | null;
    limit: number;
    offset: number;
  },
): Promise<HospitalApplicationPage> {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  const rows = await listHospitalApplications(deps.db, options);
  const total = await countHospitalApplications(deps.db, options.status);
  return { items: rows.map(toHospitalApplicationDto), total };
}

export async function decideApplication(
  deps: ServiceDeps,
  ctx: AuthContext,
  applicationId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string | null,
): Promise<HospitalProfileDto> {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  if (decision === 'REJECTED' && (!reason || reason.trim().length < 10)) {
    throw new ConflictError('A rejection reason of at least 10 characters is required.');
  }

  const updated = await deps.db.transaction(async (tx) => {
    const application = await findHospitalById(tx, applicationId);
    if (!application) throw new NotFoundError('Hospital application not found.');
    if (application.verification_status !== 'PENDING') {
      throw new ConflictError('Only a pending hospital application can be decided.');
    }

    const decided = await decideHospitalApplication(
      tx,
      applicationId,
      decision,
      ctx.user.id,
      reason,
    );
    if (!decided) throw new ConflictError('The application changed while you were reviewing it.');

    if (decision === 'APPROVED') {
      await grantRole(tx, decided.user_id, 'HOSPITAL', ctx.user.id);
    } else {
      // Defence in depth: a rejected applicant must not retain verifier access.
      await revokeRole(tx, decided.user_id, 'HOSPITAL');
    }

    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: null,
      eventType: decision === 'APPROVED' ? 'HOSPITAL_APPLICATION_APPROVED' : 'HOSPITAL_APPLICATION_REJECTED',
      metadata: {
        hospitalProfileId: decided.id,
        hospitalName: decided.hospital_name,
        decision,
      },
    });
    await notifyUsers(tx, [decided.user_id], {
      type: decision === 'APPROVED' ? 'HOSPITAL_APPLICATION_APPROVED' : 'HOSPITAL_APPLICATION_REJECTED',
      title: decision === 'APPROVED' ? 'Hospital application approved' : 'Hospital application rejected',
      message:
        decision === 'APPROVED'
          ? 'Your hospital verification application was approved. You can now review blood requests.'
          : `Your hospital verification application was rejected. Reason: ${reason ?? 'Not provided'}`,
      requestId: null,
    });

    return decided;
  });

  return toHospitalProfileDto(updated);
}
