import type { Db } from '../db/database.js';
import type { AppRole, AuthContext, AuthenticatedUser, ProfileRow } from '../types/domain.js';
import { findProfileById, upsertProfile } from './profileRepository.js';
import { findHospitalByUserId } from './hospitalRepository.js';

export async function getRoles(db: Db, userId: string): Promise<AppRole[]> {
  const result = await db.query<{ role: AppRole }>(
    'select role from public.user_roles where user_id = $1 order by role',
    [userId],
  );
  return result.rows.map((row) => row.role);
}

export async function grantRole(
  db: Db,
  userId: string,
  role: AppRole,
  grantedBy: string | null,
): Promise<void> {
  await db.query(
    `insert into public.user_roles (user_id, role, granted_by)
     values ($1, $2, $3)
     on conflict (user_id, role) do nothing`,
    [userId, role, grantedBy],
  );
}

export async function revokeRole(db: Db, userId: string, role: AppRole): Promise<void> {
  await db.query('delete from public.user_roles where user_id = $1 and role = $2', [userId, role]);
}

export async function listUserIdsByRole(db: Db, role: AppRole): Promise<string[]> {
  const result = await db.query<{ user_id: string }>(
    `select ur.user_id
       from public.user_roles ur
       join public.profiles p on p.id = ur.user_id
      where ur.role = $1 and p.account_status = 'ACTIVE'`,
    [role],
  );
  return result.rows.map((row) => row.user_id);
}

export async function listApprovedHospitalUserIds(db: Db): Promise<string[]> {
  const result = await db.query<{ user_id: string }>(
    `select hp.user_id
       from public.hospital_profiles hp
       join public.profiles p on p.id = hp.user_id
       join public.user_roles ur on ur.user_id = hp.user_id and ur.role = 'HOSPITAL'
      where hp.verification_status = 'APPROVED' and p.account_status = 'ACTIVE'`,
  );
  return result.rows.map((row) => row.user_id);
}

/**
 * Loads authoritative authorization data for an authenticated Supabase user.
 * Roles are read from the database, never from client-editable user metadata.
 */
export async function buildAuthContext(
  db: Db,
  user: AuthenticatedUser,
): Promise<AuthContext> {
  let profile: ProfileRow | null = await findProfileById(db, user.id);

  if (!profile) {
    // Defensive recovery if the signup trigger has not run (e.g. users created
    // directly by a Supabase admin call). The profile id still references the
    // existing auth user.
    const fallbackName = (user.email ?? 'New user').split('@')[0] ?? 'New user';
    profile = await upsertProfile(db, user.id, {
      fullName: fallbackName,
      phoneNumber: null,
      city: '',
      area: '',
      postalCode: null,
    });
  }

  const roles = await getRoles(db, user.id);
  const isAdmin = roles.includes('ADMIN');
  const hospital = await findHospitalByUserId(db, user.id);
  const isApprovedHospital =
    roles.includes('HOSPITAL') && hospital?.verification_status === 'APPROVED';

  return {
    user,
    profile,
    roles,
    accountStatus: profile.account_status,
    isAdmin,
    isApprovedHospital,
  };
}
