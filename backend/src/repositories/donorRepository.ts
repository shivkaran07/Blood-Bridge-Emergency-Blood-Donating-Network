import type { Db } from '../db/database.js';
import type { BloodGroup, DonorProfileRow, RequestStatus } from '../types/domain.js';

export interface DonorProfileInput {
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  consentToContact: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface DonorCandidateRow extends DonorProfileRow {
  full_name: string;
  city: string | null;
  area: string | null;
}

export async function findDonorByUserId(db: Db, userId: string): Promise<DonorProfileRow | null> {
  const result = await db.query<DonorProfileRow>(
    'select * from public.donor_profiles where user_id = $1',
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function upsertDonorProfile(
  db: Db,
  userId: string,
  input: DonorProfileInput,
): Promise<DonorProfileRow> {
  const result = await db.query<DonorProfileRow>(
    `insert into public.donor_profiles
       (user_id, blood_group, is_available, consent_to_contact, latitude, longitude, privacy_consent_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (user_id) do update
       set blood_group = excluded.blood_group,
           is_available = excluded.is_available,
           consent_to_contact = excluded.consent_to_contact,
           latitude = excluded.latitude,
           longitude = excluded.longitude
     returning *`,
    [
      userId,
      input.bloodGroup,
      input.isAvailable,
      input.consentToContact,
      input.consentToContact ? input.latitude : null,
      input.consentToContact ? input.longitude : null,
    ],
  );
  return result.rows[0]!;
}

export async function setDonorAvailability(
  db: Db,
  userId: string,
  isAvailable: boolean,
): Promise<DonorProfileRow | null> {
  const result = await db.query<DonorProfileRow>(
    `update public.donor_profiles set is_available = $2 where user_id = $1 returning *`,
    [userId, isAvailable],
  );
  return result.rows[0] ?? null;
}

/**
 * Candidate pool for exact-blood-group matching. Donor coordinates are used
 * only inside the service to calculate a rounded distance; they are never
 * returned by the API.
 */
export async function findDonorCandidates(
  db: Db,
  options: {
    bloodGroup: BloodGroup;
    requestId: string;
    excludeUserId: string;
    limit?: number;
  },
): Promise<DonorCandidateRow[]> {
  const result = await db.query<DonorCandidateRow>(
    `select dp.*, p.full_name, p.city, p.area
       from public.donor_profiles dp
       join public.profiles p on p.id = dp.user_id
      where dp.blood_group = $1
        and dp.is_available = true
        and dp.consent_to_contact = true
        and p.account_status = 'ACTIVE'
        and dp.user_id <> $2
        and not exists (
          select 1
            from public.donor_responses dr
           where dr.request_id = $3
             and dr.donor_id = dp.user_id
             and dr.response_status in ('OFFERED', 'ACCEPTED', 'COMPLETED')
        )
      order by p.city nulls last, p.area nulls last, dp.updated_at desc
      limit $4`,
    [options.bloodGroup, options.excludeUserId, options.requestId, options.limit ?? 100],
  );
  return result.rows;
}

export async function donorStats(
  db: Db,
  userId: string,
): Promise<{ offered: number; accepted: number; completed: number; withdrawn: number }> {
  const result = await db.query<{
    offered: number;
    accepted: number;
    completed: number;
    withdrawn: number;
  }>(
    `select
       count(*) filter (where response_status = 'OFFERED')::int as offered,
       count(*) filter (where response_status = 'ACCEPTED')::int as accepted,
       count(*) filter (where response_status = 'COMPLETED')::int as completed,
       count(*) filter (where response_status = 'WITHDRAWN')::int as withdrawn
     from public.donor_responses
     where donor_id = $1`,
    [userId],
  );
  return result.rows[0] ?? { offered: 0, accepted: 0, completed: 0, withdrawn: 0 };
}

export async function countOpenRequestsForDonor(
  db: Db,
  bloodGroup: BloodGroup,
): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.blood_requests
      where blood_group = $1
        and status in ('VERIFIED', 'PARTIALLY_FULFILLED')
        and needed_by > now()`,
    [bloodGroup],
  );
  return result.rows[0]?.count ?? 0;
}

export type { RequestStatus };
