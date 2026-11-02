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
import { NotFoundError, ServiceUnavailableError } from '../lib/errors.js';
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
    emailNotificationsEnabled: profile.email_notifications_enabled,
    emailNotificationsAvailable: Boolean(
      deps.config.email.resendApiKey && deps.config.email.fromAddress,
    ),
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

export async function updateEmailNotifications(
  deps: ServiceDeps,
  ctx: AuthContext,
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  if (enabled && (!deps.config.email.resendApiKey || !deps.config.email.fromAddress)) {
    throw new ServiceUnavailableError(
      'Email alerts are not configured by this BloodBridge deployment.',
    );
  }
  return deps.db.transaction(async (tx) => {
    const updated = await tx.query<{ email_notifications_enabled: boolean }>(
      `update public.profiles
          set email_notifications_enabled = $2
        where id = $1
        returning email_notifications_enabled`,
      [ctx.user.id, enabled],
    );
    if (!updated.rows[0]) throw new NotFoundError('Profile not found.');

    if (!enabled) {
      await tx.query(
        `update public.notification_email_outbox o
            set status = 'EXPIRED', lease_expires_at = null
           from public.notifications n
          where o.notification_id = n.id
            and n.recipient_user_id = $1
            and o.status in ('PENDING', 'SENDING')`,
        [ctx.user.id],
      );
    }

    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      requestId: null,
      eventType: 'PROFILE_UPDATED',
      metadata: { fields: ['email_notifications_enabled'] },
    });
    return { enabled: updated.rows[0].email_notifications_enabled };
  });
}
