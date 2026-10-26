import type { AuthContext, AppRole, BloodGroup, RequestPriority, RequestStatus } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import { getAdminStats, activityByDay, type AdminStats } from '../repositories/adminRepository.js';
import {
  countAdminRequests,
  listAdminRequests,
  listSuspiciousRequests,
} from '../repositories/requestRepository.js';
import {
  countAdminUsers,
  findProfileById,
  listAdminUsers,
  setAccountStatus,
} from '../repositories/profileRepository.js';
import { getRoles } from '../repositories/userRepository.js';
import { listAuditEvents, countAuditEvents } from '../repositories/auditRepository.js';
import { blockchainTransactionCountsForRequests } from '../repositories/blockchainRepository.js';
import { countHospitalApplications } from '../repositories/hospitalRepository.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';
import { notifyUsers, writeAudit } from './notificationService.js';
import {
  toAdminUserDto,
  toAuditDto,
  toRequestDto,
  toSuspiciousDto,
  type AdminUserDto,
  type AuditEventDto,
  type BloodRequestDto,
  type SuspiciousRequestDto,
} from './serializers.js';
import { adminCancelBloodRequest } from './requestService.js';

export interface AdminRequestFilter {
  status: RequestStatus | null;
  bloodGroup: BloodGroup | null;
  priority: RequestPriority | null;
  city: string | null;
  search: string;
  limit: number;
  offset: number;
}

export async function getOperationalStats(deps: ServiceDeps, ctx: AuthContext): Promise<AdminStats> {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  return getAdminStats(deps.db);
}

export async function getOperationalActivity(deps: ServiceDeps, ctx: AuthContext) {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  return activityByDay(deps.db, 7);
}

export async function listUsers(
  deps: ServiceDeps,
  ctx: AuthContext,
  options: { search: string; limit: number; offset: number },
): Promise<{ items: AdminUserDto[]; total: number }> {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  const rows = await listAdminUsers(deps.db, options);
  const total = await countAdminUsers(deps.db, options.search);
  return { items: rows.map(toAdminUserDto), total };
}

export async function updateUserStatus(
  deps: ServiceDeps,
  ctx: AuthContext,
  userId: string,
  status: 'ACTIVE' | 'SUSPENDED',
  reason: string | null,
): Promise<{ id: string; accountStatus: string }> {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  if (userId === ctx.user.id) {
    throw new ForbiddenError('You cannot change your own account status.');
  }

  const target = await findProfileById(deps.db, userId);
  if (!target) throw new NotFoundError('User not found.');

  const targetRoles = await getRoles(deps.db, userId);
  if (targetRoles.includes('ADMIN')) {
    throw new ForbiddenError(
      'Administrator accounts cannot be suspended through this endpoint. Use the documented break-glass procedure.',
    );
  }
  if (status === 'SUSPENDED' && (!reason || reason.trim().length < 10)) {
    throw new ConflictError('A suspension reason of at least 10 characters is required.');
  }
  if (target.account_status === status) {
    return { id: target.id, accountStatus: target.account_status };
  }

  await deps.db.transaction(async (tx) => {
    const updated = await setAccountStatus(tx, userId, status);
    if (!updated) throw new NotFoundError('User not found.');

    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: null,
      eventType: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      metadata: {
        targetUserId: userId,
        previousStatus: target.account_status,
        reasonProvided: Boolean(reason),
      },
    });
    await notifyUsers(tx, [userId], {
      type: status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_REACTIVATED',
      title: status === 'SUSPENDED' ? 'Account suspended' : 'Account reactivated',
      message:
        status === 'SUSPENDED'
          ? `An administrator suspended your account. Reason: ${reason ?? 'Not provided'}`
          : 'An administrator reactivated your account. You can sign in again.',
      requestId: null,
    });
  });

  return { id: userId, accountStatus: status };
}

export async function listRequestsForAdmin(
  deps: ServiceDeps,
  ctx: AuthContext,
  filters: AdminRequestFilter,
): Promise<{ items: BloodRequestDto[]; total: number; limit: number; offset: number }> {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  const rows = await listAdminRequests(deps.db, filters);
  const total = await countAdminRequests(deps.db, filters);
  const txCounts = await blockchainTransactionCountsForRequests(
    deps.db,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) =>
      toRequestDto(row, {
        viewer: ctx,
        includeRequesterContact: false,
        includeAuditKey: true,
        canRespond: false,
        transactionCount: txCounts.get(row.id) ?? 0,
      }),
    ),
    total,
    limit: filters.limit,
    offset: filters.offset,
  };
}

export async function listSuspiciousForAdmin(
  deps: ServiceDeps,
  ctx: AuthContext,
): Promise<{ items: SuspiciousRequestDto[]; total: number }> {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  const rows = await listSuspiciousRequests(deps.db);
  const txCounts = await blockchainTransactionCountsForRequests(
    deps.db,
    rows.map((row) => row.id),
  );
  return {
    items: rows.map((row) => toSuspiciousDto(row, ctx, txCounts.get(row.id) ?? 0)),
    total: rows.length,
  };
}

export async function cancelRequestAsAdmin(
  deps: ServiceDeps,
  ctx: AuthContext,
  requestId: string,
  reason: string,
): Promise<BloodRequestDto> {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  return adminCancelBloodRequest(deps, ctx, requestId, reason);
}

export async function listAuditForAdmin(
  deps: ServiceDeps,
  ctx: AuthContext,
  filters: {
    eventType: string | null;
    actorUserId: string | null;
    requestId: string | null;
    limit: number;
    offset: number;
  },
): Promise<{ items: AuditEventDto[]; total: number }> {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  const rows = await listAuditEvents(deps.db, filters);
  const total = await countAuditEvents(deps.db, filters);
  return { items: rows.map(toAuditDto), total };
}

export async function getAdminOverview(deps: ServiceDeps, ctx: AuthContext) {
  if (!ctx.isAdmin) throw new ForbiddenError('Administrator access is required.');
  const stats = await getAdminStats(deps.db);
  const pendingApplications = await countHospitalApplications(deps.db, 'PENDING');
  const suspicious = await listSuspiciousRequests(deps.db);
  const audit = await listAuditEvents(deps.db, {
    eventType: null,
    actorUserId: null,
    requestId: null,
    limit: 8,
    offset: 0,
  });
  const activity = await activityByDay(deps.db, 7);

  return {
    stats,
    pendingApplications,
    suspiciousCount: suspicious.length,
    recentAudit: audit.map(toAuditDto),
    activity,
  };
}

export type { AppRole, AdminUserDto };
