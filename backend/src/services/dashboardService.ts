import type { AuthContext } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import {
  requesterRequestSummary,
  recentRequesterActivity,
} from '../repositories/requestRepository.js';
import {
  findDonorByUserId,
  countOpenRequestsForDonor,
} from '../repositories/donorRepository.js';
import { donorResponseSummary } from '../repositories/responseRepository.js';
import { unreadNotificationCount } from '../repositories/notificationRepository.js';
import { listMyRequests } from './requestService.js';
import { listOwnResponses } from './responseService.js';
import { getHospitalDashboard } from './hospitalService.js';
import { getAdminOverview } from './adminService.js';
import { toDonorProfileDto, type BloodRequestDto } from './serializers.js';
import { toIso } from '../lib/serialize.js';

export interface DashboardActivity {
  id: string;
  requestId: string;
  hospitalName: string;
  bloodGroup: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}

export async function getDashboard(deps: ServiceDeps, ctx: AuthContext) {
  const requesterSummary = await requesterRequestSummary(deps.db, ctx.user.id);
  const recentRequests = await listMyRequests(deps, ctx, { status: null, limit: 5, offset: 0 });
  const activityRows = await recentRequesterActivity(deps.db, ctx.user.id, 8);
  const activity: DashboardActivity[] = activityRows.map((row) => ({
    id: row.id,
    requestId: row.request_id,
    hospitalName: row.hospital_name,
    bloodGroup: row.blood_group,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    createdAt: toIso(row.created_at),
  }));

  const donor = await findDonorByUserId(deps.db, ctx.user.id);
  let donorSection = null;
  if (donor) {
    const summary = await donorResponseSummary(deps.db, ctx.user.id);
    const availableRequests = await countOpenRequestsForDonor(deps.db, donor.blood_group);
    const responses = await listOwnResponses(deps, ctx, { limit: 5, offset: 0 });
    donorSection = {
      profile: toDonorProfileDto(donor),
      summary,
      availableRequests,
      recentResponses: responses,
    };
  }

  const hospitalSection = ctx.isApprovedHospital
    ? await getHospitalDashboard(deps, ctx)
    : null;

  const admin = ctx.isAdmin ? await getAdminOverview(deps, ctx) : null;
  const unread = await unreadNotificationCount(deps.db, ctx.user.id);

  return {
    requester: {
      summary: requesterSummary,
      recentRequests: recentRequests.items as BloodRequestDto[],
      recentActivity: activity,
    },
    donor: donorSection,
    hospital: hospitalSection,
    admin,
    unreadNotifications: unread,
  };
}
