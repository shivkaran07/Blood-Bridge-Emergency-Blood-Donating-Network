import type { Db } from '../db/database.js';
import type {
  HospitalProfileRow,
  HospitalVerificationStatus,
} from '../types/domain.js';
import type { HospitalApplicationRow } from './types.js';

export interface HospitalApplicationInput {
  hospitalName: string;
  registrationNumber: string;
  contactPerson: string;
  contactPhone: string;
  officialEmail: string;
  address: string;
  city: string;
  area: string;
}

export async function findHospitalByUserId(
  db: Db,
  userId: string,
): Promise<HospitalProfileRow | null> {
  const result = await db.query<HospitalProfileRow>(
    'select * from public.hospital_profiles where user_id = $1',
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function findHospitalById(
  db: Db,
  id: string,
): Promise<HospitalProfileRow | null> {
  const result = await db.query<HospitalProfileRow>(
    'select * from public.hospital_profiles where id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

/**
 * Creates an application, or allows a rejected applicant to correct and
 * resubmit. Pending/approved applications cannot be overwritten here.
 */
export async function createOrResubmitHospitalApplication(
  db: Db,
  userId: string,
  input: HospitalApplicationInput,
): Promise<HospitalProfileRow | null> {
  const result = await db.query<HospitalProfileRow>(
    `insert into public.hospital_profiles
       (user_id, hospital_name, registration_number, contact_person, contact_phone,
        official_email, address, city, area, verification_status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
     on conflict (user_id) do update
       set hospital_name = excluded.hospital_name,
           registration_number = excluded.registration_number,
           contact_person = excluded.contact_person,
           contact_phone = excluded.contact_phone,
           official_email = excluded.official_email,
           address = excluded.address,
           city = excluded.city,
           area = excluded.area,
           verification_status = 'PENDING',
           review_reason = null,
           verified_by = null,
           verified_at = null
       where public.hospital_profiles.verification_status = 'REJECTED'
     returning *`,
    [
      userId,
      input.hospitalName,
      input.registrationNumber,
      input.contactPerson,
      input.contactPhone,
      input.officialEmail,
      input.address,
      input.city,
      input.area,
    ],
  );
  return result.rows[0] ?? null;
}

export async function listHospitalApplications(
  db: Db,
  options: { status: HospitalVerificationStatus | null; limit: number; offset: number },
): Promise<HospitalApplicationRow[]> {
  const result = await db.query<HospitalApplicationRow>(
    `select hp.*,
            p.full_name as applicant_name,
            u.email as applicant_email,
            v.full_name as verified_by_name
       from public.hospital_profiles hp
       join public.profiles p on p.id = hp.user_id
       join auth.users u on u.id = hp.user_id
       left join public.profiles v on v.id = hp.verified_by
      where ($1::public.hospital_verification_status is null or hp.verification_status = $1)
      order by
        case hp.verification_status when 'PENDING' then 0 else 1 end,
        hp.created_at desc
      limit $2 offset $3`,
    [options.status, options.limit, options.offset],
  );
  return result.rows;
}

export async function countHospitalApplications(
  db: Db,
  status: HospitalVerificationStatus | null,
): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.hospital_profiles
      where ($1::public.hospital_verification_status is null or verification_status = $1)`,
    [status],
  );
  return result.rows[0]?.count ?? 0;
}

export async function decideHospitalApplication(
  db: Db,
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  adminId: string,
  reason: string | null,
): Promise<HospitalProfileRow | null> {
  const result = await db.query<HospitalProfileRow>(
    `update public.hospital_profiles
        set verification_status = $2,
            review_reason = $3,
            verified_by = $4,
            verified_at = now()
      where id = $1 and verification_status = 'PENDING'
      returning *`,
    [id, decision, reason, adminId],
  );
  return result.rows[0] ?? null;
}

export async function setHospitalVerificationStatus(
  db: Db,
  id: string,
  status: 'SUSPENDED' | 'APPROVED',
  adminId: string,
  reason: string | null,
): Promise<HospitalProfileRow | null> {
  const result = await db.query<HospitalProfileRow>(
    `update public.hospital_profiles
        set verification_status = $2,
            review_reason = $3,
            verified_by = $4,
            verified_at = now()
      where id = $1
      returning *`,
    [id, status, reason, adminId],
  );
  return result.rows[0] ?? null;
}
