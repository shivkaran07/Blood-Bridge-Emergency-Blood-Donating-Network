import type { Db } from '../db/database.js';
import type { DonorResponseRow, ResponseStatus } from '../types/domain.js';
import type { ResponseWithDonor } from './types.js';

const RESPONSE_DETAIL_SELECT = `
  dr.*,
  r.requester_id,
  r.status as request_status,
  r.blood_group as request_blood_group,
  r.needed_by as request_needed_by,
  r.hospital_name as request_hospital_name,
  r.hospital_city as request_hospital_city,
  r.hospital_area as request_hospital_area,
  p.full_name as donor_name,
  p.phone_number as donor_phone,
  p.city as donor_city,
  p.area as donor_area,
  dp.blood_group as donor_blood_group,
  coalesce(dp.consent_to_contact, false) as consent_to_contact
`;

export async function insertResponse(
  db: Db,
  requestId: string,
  donorId: string,
): Promise<DonorResponseRow> {
  const result = await db.query<DonorResponseRow>(
    `insert into public.donor_responses (request_id, donor_id, response_status)
     values ($1, $2, 'OFFERED')
     returning *`,
    [requestId, donorId],
  );
  return result.rows[0]!;
}

export async function findResponseById(
  db: Db,
  id: string,
): Promise<ResponseWithDonor | null> {
  const result = await db.query<ResponseWithDonor>(
    `select ${RESPONSE_DETAIL_SELECT}
       from public.donor_responses dr
       join public.blood_requests r on r.id = dr.request_id
       join public.profiles p on p.id = dr.donor_id
       left join public.donor_profiles dp on dp.user_id = dr.donor_id
      where dr.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findResponseForUpdate(
  db: Db,
  id: string,
): Promise<DonorResponseRow | null> {
  const result = await db.query<DonorResponseRow>(
    'select * from public.donor_responses where id = $1 for update',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findActiveResponse(
  db: Db,
  requestId: string,
  donorId: string,
): Promise<DonorResponseRow | null> {
  const result = await db.query<DonorResponseRow>(
    `select * from public.donor_responses
      where request_id = $1 and donor_id = $2
        and response_status in ('OFFERED', 'ACCEPTED', 'COMPLETED')
      limit 1`,
    [requestId, donorId],
  );
  return result.rows[0] ?? null;
}

export async function listResponsesForRequest(
  db: Db,
  requestId: string,
): Promise<ResponseWithDonor[]> {
  const result = await db.query<ResponseWithDonor>(
    `select ${RESPONSE_DETAIL_SELECT}
       from public.donor_responses dr
       join public.blood_requests r on r.id = dr.request_id
       join public.profiles p on p.id = dr.donor_id
       left join public.donor_profiles dp on dp.user_id = dr.donor_id
      where dr.request_id = $1
      order by dr.created_at asc`,
    [requestId],
  );
  return result.rows;
}

export async function listDonorActiveRequestIds(
  db: Db,
  donorId: string,
): Promise<Set<string>> {
  const result = await db.query<{ request_id: string }>(
    `select request_id from public.donor_responses
      where donor_id = $1
        and response_status in ('OFFERED', 'ACCEPTED', 'COMPLETED')`,
    [donorId],
  );
  return new Set(result.rows.map((row) => row.request_id));
}

export async function listResponsesForDonor(
  db: Db,
  donorId: string,
  options: { limit: number; offset: number },
): Promise<ResponseWithDonor[]> {
  const result = await db.query<ResponseWithDonor>(
    `select ${RESPONSE_DETAIL_SELECT}
       from public.donor_responses dr
       join public.blood_requests r on r.id = dr.request_id
       join public.profiles p on p.id = dr.donor_id
       left join public.donor_profiles dp on dp.user_id = dr.donor_id
      where dr.donor_id = $1
      order by dr.created_at desc
      limit $2 offset $3`,
    [donorId, options.limit, options.offset],
  );
  return result.rows;
}

export async function countResponsesForDonor(db: Db, donorId: string): Promise<number> {
  const result = await db.query<{ count: number }>(
    'select count(*)::int as count from public.donor_responses where donor_id = $1',
    [donorId],
  );
  return result.rows[0]?.count ?? 0;
}

export async function countResponsesForRequest(db: Db, requestId: string): Promise<number> {
  const result = await db.query<{ count: number }>(
    'select count(*)::int as count from public.donor_responses where request_id = $1',
    [requestId],
  );
  return result.rows[0]?.count ?? 0;
}

/**
 * Status update is guarded by the allowed "from" states, making concurrent
 * accept/withdraw requests race-safe.
 */
export async function updateResponseStatus(
  db: Db,
  id: string,
  toStatus: ResponseStatus,
  allowedFrom: ResponseStatus[],
): Promise<DonorResponseRow | null> {
  const result = await db.query<DonorResponseRow>(
    `update public.donor_responses
        set response_status = $2
      where id = $1
        and response_status = any($3::public.response_status[])
      returning *`,
    [id, toStatus, `{${allowedFrom.join(',')}}`],
  );
  return result.rows[0] ?? null;
}

export async function listDonorsWithActiveResponses(
  db: Db,
  requestId: string,
): Promise<Array<{ donor_id: string; response_status: ResponseStatus }>> {
  const result = await db.query<{ donor_id: string; response_status: ResponseStatus }>(
    `select donor_id, response_status
       from public.donor_responses
      where request_id = $1
        and response_status in ('OFFERED', 'ACCEPTED', 'COMPLETED')`,
    [requestId],
  );
  return result.rows;
}

/**
 * Closes active offers when a request is cancelled or expires. Accepted
 * responses are also closed because coordination can no longer proceed.
 */
export async function cancelActiveResponsesForRequest(
  db: Db,
  requestId: string,
): Promise<Array<{ donor_id: string; response_status: ResponseStatus }>> {
  const result = await db.query<{ donor_id: string; response_status: ResponseStatus }>(
    `update public.donor_responses
        set response_status = 'CANCELLED'
      where request_id = $1
        and response_status in ('OFFERED', 'ACCEPTED')
      returning donor_id, response_status`,
    [requestId],
  );
  return result.rows;
}

export async function donorResponseSummary(
  db: Db,
  donorId: string,
): Promise<{ total: number; offered: number; accepted: number; completed: number }> {
  const result = await db.query<{
    total: number;
    offered: number;
    accepted: number;
    completed: number;
  }>(
    `select
       count(*)::int as total,
       count(*) filter (where response_status = 'OFFERED')::int as offered,
       count(*) filter (where response_status = 'ACCEPTED')::int as accepted,
       count(*) filter (where response_status = 'COMPLETED')::int as completed
     from public.donor_responses
     where donor_id = $1`,
    [donorId],
  );
  return result.rows[0] ?? { total: 0, offered: 0, accepted: 0, completed: 0 };
}
