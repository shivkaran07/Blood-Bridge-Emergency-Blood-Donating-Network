import type { AuthContext } from '../types/domain.js';
import type { ServiceDeps } from './deps.js';
import { findDonorByUserId } from '../repositories/donorRepository.js';
import { findHospitalByUserId } from '../repositories/hospitalRepository.js';
import { unreadNotificationCount } from '../repositories/notificationRepository.js';
import {
  findProfileById,
  upsertProfile,
  type ProfileUpdateInput,
} from '../repositories/profileRepository.js';
import { writeAudit } from './notificationService.js';
import { toDonorProfileDto, toHospitalProfileDto, toProfileDto, type MeDto } from './serializers.js';

export async function getMe(deps: ServiceDeps, ctx: AuthContext): Promise<MeDto> {
  const profile = (await findProfileById(deps.db, ctx.user.id)) ?? ctx.profile;
  const [donor, hospital, unread] = await Promise.all([
    findDonorByUserId(deps.db, ctx.user.id),
    findHospitalByUserId(deps.db, ctx.user.id),
    unreadNotificationCount(deps.db, ctx.user.id),
  ]);

  const profileComplete = Boolean(
    profile.full_name.trim().length >= 2 &&
      profile.phone_number &&
      profile.city &&
      profile.area,
  );

  return {
    user: { id: ctx.user.id, email: ctx.user.email },
    profile: toProfileDto(profile),
    roles: ctx.roles,
    permissions: {
      isAdmin: ctx.isAdmin,
      isDonor: Boolean(donor),
      isHospital: Boolean(hospital),
      isApprovedVerifier: ctx.isApprovedHospital,
    },
    profileComplete,
    donorProfile: donor ? toDonorProfileDto(donor) : null,
    hospitalProfile: hospital ? toHospitalProfileDto(hospital) : null,
    unreadNotifications: unread,
  };
}

export async function updateOwnProfile(
  deps: ServiceDeps,
  ctx: AuthContext,
  input: ProfileUpdateInput,
) {
  // upsert covers the rare case where the signup trigger did not create a row.
  const updated = await upsertProfile(deps.db, ctx.user.id, input);
  await writeAudit(deps.db, {
    actorUserId: ctx.user.id,
    requestId: null,
    eventType: 'PROFILE_UPDATED',
    metadata: {
      fields: ['full_name', 'phone_number', 'city', 'area', 'postal_code'],
    },
  });
  return toProfileDto(updated);
}
