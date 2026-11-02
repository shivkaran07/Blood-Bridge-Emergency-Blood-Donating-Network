import type { Db } from '../db/database.js';
import type { ProfileRow } from '../types/domain.js';
import type { AdminUserRow } from './types.js';

export interface ProfileUpdateInput {
  fullName: string;
  phoneNumber: string | null;
  city: string;
  area: string;
  postalCode: string | null;
}

export async function findProfileById(db: Db, userId: string): Promise<ProfileRow | null> {
  const result = await db.query<ProfileRow>('select * from public.profiles where id = $1', [userId]);
  return result.rows[0] ?? null;
}

/**
 * Creates a missing profile or updates the editable fields. The ON CONFLICT
 * branch deliberately never touches account_status or id.
 */
export async function upsertProfile(
  db: Db,
  userId: string,
  input: ProfileUpdateInput,
): Promise<ProfileRow> {
  const result = await db.query<ProfileRow>(
    `insert into public.profiles (id, full_name, phone_number, city, area, postal_code)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update
       set full_name = excluded.full_name,
           phone_number = excluded.phone_number,
           city = excluded.city,
           area = excluded.area,
           postal_code = excluded.postal_code
     returning *`,
    [
      userId,
      input.fullName,
      input.phoneNumber,
      input.city,
      input.area,
      input.postalCode,
    ],
  );
  return result.rows[0]!;
}

export async function updateProfile(
  db: Db,
  userId: string,
  input: ProfileUpdateInput,
): Promise<ProfileRow | null> {
  const result = await db.query<ProfileRow>(
    `update public.profiles
        set full_name = $2,
            phone_number = $3,
            city = $4,
            area = $5,
            postal_code = $6
      where id = $1
      returning *`,
    [userId, input.fullName, input.phoneNumber, input.city, input.area, input.postalCode],
  );
  return result.rows[0] ?? null;
}

export async function listAdminUsers(
  db: Db,
  options: { search: string; limit: number; offset: number },
): Promise<AdminUserRow[]> {
  const result = await db.query<AdminUserRow>(
    `select p.id,
            p.full_name,
            u.email,
            p.phone_number,
            p.city,
            p.account_status,
            p.created_at,
            coalesce(
              json_agg(distinct ur.role) filter (where ur.role is not null),
              '[]'::json
            ) as roles,
            hp.verification_status as hospital_status,
            hp.hospital_name
       from public.profiles p
       join auth.users u on u.id = p.id
       left join public.user_roles ur on ur.user_id = p.id
       left join public.hospital_profiles hp on hp.user_id = p.id
      where ($1 = ''
             or p.full_name ilike '%' || $1 || '%'
             or u.email ilike '%' || $1 || '%')
      group by p.id, u.email, hp.verification_status, hp.hospital_name
      order by p.created_at desc
      limit $2 offset $3`,
    [options.search, options.limit, options.offset],
  );
  return result.rows;
}

export async function countAdminUsers(db: Db, search: string): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.profiles p
       join auth.users u on u.id = p.id
      where ($1 = '' or p.full_name ilike '%' || $1 || '%' or u.email ilike '%' || $1 || '%')`,
    [search],
  );
  return result.rows[0]?.count ?? 0;
}

export async function setAccountStatus(
  db: Db,
  userId: string,
  status: 'ACTIVE' | 'SUSPENDED',
): Promise<ProfileRow | null> {
  const result = await db.query<ProfileRow>(
    `update public.profiles set account_status = $2 where id = $1 returning *`,
    [userId, status],
  );
  return result.rows[0] ?? null;
}

export async function emailForUser(db: Db, userId: string): Promise<string | null> {
  const result = await db.query<{ email: string | null }>(
    'select email from auth.users where id = $1',
    [userId],
  );
  return result.rows[0]?.email ?? null;
}
