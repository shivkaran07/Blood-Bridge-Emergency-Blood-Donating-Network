import type { Db } from '../db/database.js';
import type {
  BloodGroup,
  BloodRequestRow,
  RequestHistoryRow,
  RequestPriority,
  RequestStatus,
} from '../types/domain.js';
import type {
  RequestWithMeta,
  SuspiciousRequestRow,
} from './types.js';

const REQUEST_META_SELECT = `
  r.*,
  p.full_name as requester_name,
  (select count(*)::int from public.donor_responses dr
    where dr.request_id = r.id
      and dr.response_status in ('OFFERED', 'ACCEPTED', 'COMPLETED')) as response_count,
  (select count(*)::int from public.donor_responses dr
    where dr.request_id = r.id
      and dr.response_status in ('ACCEPTED', 'COMPLETED')) as accepted_response_count
`;

export interface CreateRequestInput {
  requesterId: string;
  bloodGroup: BloodGroup;
  unitsRequested: number;
  hospitalName: string;
  hospitalCity: string;
  hospitalArea: string;
  hospitalLatitude: number | null;
  hospitalLongitude: number | null;
  neededBy: string;
  priority: RequestPriority;
  publicMessage: string | null;
  requesterContactPhone: string;
  contactShareConsent: boolean;
  blockchainAuditKey: string;
}

export async function insertRequest(
  db: Db,
  input: CreateRequestInput,
): Promise<BloodRequestRow> {
  const result = await db.query<BloodRequestRow>(
    `insert into public.blood_requests
       (requester_id, blood_group, units_requested, hospital_name, hospital_city,
        hospital_area, hospital_latitude, hospital_longitude, needed_by, priority,
        public_message, requester_contact_phone, contact_share_consent, status,
        blockchain_audit_key, blockchain_sync_status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
             'SUBMITTED', $14, 'NOT_SCHEDULED')
     returning *`,
    [
      input.requesterId,
      input.bloodGroup,
      input.unitsRequested,
      input.hospitalName,
      input.hospitalCity,
      input.hospitalArea,
      input.hospitalLatitude,
      input.hospitalLongitude,
      input.neededBy,
      input.priority,
      input.publicMessage,
      input.requesterContactPhone,
      input.contactShareConsent,
      input.blockchainAuditKey,
    ],
  );
  return result.rows[0]!;
}

export async function findRequestById(db: Db, id: string): Promise<RequestWithMeta | null> {
  const result = await db.query<RequestWithMeta>(
    `select ${REQUEST_META_SELECT}
       from public.blood_requests r
       join public.profiles p on p.id = r.requester_id
      where r.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findRequestForUpdate(
  db: Db,
  id: string,
): Promise<BloodRequestRow | null> {
  const result = await db.query<BloodRequestRow>(
    'select * from public.blood_requests where id = $1 for update',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function listRequestsByRequester(
  db: Db,
  requesterId: string,
  options: { status: RequestStatus | null; limit: number; offset: number },
): Promise<RequestWithMeta[]> {
  const result = await db.query<RequestWithMeta>(
    `select ${REQUEST_META_SELECT}
       from public.blood_requests r
       join public.profiles p on p.id = r.requester_id
      where r.requester_id = $1
        and ($2::public.request_status is null or r.status = $2)
      order by r.created_at desc
      limit $3 offset $4`,
    [requesterId, options.status, options.limit, options.offset],
  );
  return result.rows;
}

export async function countRequestsByRequester(
  db: Db,
  requesterId: string,
  status: RequestStatus | null = null,
): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.blood_requests
      where requester_id = $1
        and ($2::public.request_status is null or status = $2)`,
    [requesterId, status],
  );
  return result.rows[0]?.count ?? 0;
}

export async function listRequestFeed(
  db: Db,
  options: {
    bloodGroup: BloodGroup | null;
    city: string | null;
    limit: number;
    offset: number;
  },
): Promise<RequestWithMeta[]> {
  const result = await db.query<RequestWithMeta>(
    `select ${REQUEST_META_SELECT}
       from public.blood_requests r
       join public.profiles p on p.id = r.requester_id
      where r.status in ('VERIFIED', 'PARTIALLY_FULFILLED')
        and r.needed_by > now()
        and ($1::public.blood_group is null or r.blood_group = $1)
        and ($2::text is null or lower(r.hospital_city) = lower($2))
      order by
        case r.priority when 'CRITICAL' then 1 when 'URGENT' then 2 else 3 end,
        r.needed_by asc
      limit $3 offset $4`,
    [options.bloodGroup, options.city, options.limit, options.offset],
  );
  return result.rows;
}

export async function countRequestFeed(
  db: Db,
  options: { bloodGroup: BloodGroup | null; city: string | null },
): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.blood_requests
      where status in ('VERIFIED', 'PARTIALLY_FULFILLED')
        and needed_by > now()
        and ($1::public.blood_group is null or blood_group = $1)
        and ($2::text is null or lower(hospital_city) = lower($2))`,
    [options.bloodGroup, options.city],
  );
  return result.rows[0]?.count ?? 0;
}

export async function listHospitalQueue(
  db: Db,
  options: { limit: number; offset: number },
): Promise<RequestWithMeta[]> {
  const result = await db.query<RequestWithMeta>(
    `select ${REQUEST_META_SELECT}
       from public.blood_requests r
       join public.profiles p on p.id = r.requester_id
      where r.status in ('SUBMITTED', 'UNDER_REVIEW')
        and r.needed_by > now()
      order by
        case r.priority when 'CRITICAL' then 1 when 'URGENT' then 2 else 3 end,
        r.needed_by asc,
        r.created_at asc
      limit $1 offset $2`,
    [options.limit, options.offset],
  );
  return result.rows;
}

export async function countHospitalQueue(db: Db): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count from public.blood_requests
      where status in ('SUBMITTED', 'UNDER_REVIEW') and needed_by > now()`,
  );
  return result.rows[0]?.count ?? 0;
}

export async function listAdminRequests(
  db: Db,
  options: {
    status: RequestStatus | null;
    bloodGroup: BloodGroup | null;
    priority: RequestPriority | null;
    city: string | null;
    search: string;
    limit: number;
    offset: number;
  },
): Promise<RequestWithMeta[]> {
  const result = await db.query<RequestWithMeta>(
    `select ${REQUEST_META_SELECT}
       from public.blood_requests r
       join public.profiles p on p.id = r.requester_id
      where ($1::public.request_status is null or r.status = $1)
        and ($2::public.blood_group is null or r.blood_group = $2)
        and ($3::public.request_priority is null or r.priority = $3)
        and ($4::text is null or lower(r.hospital_city) = lower($4))
        and ($5 = '' or r.hospital_name ilike '%' || $5 || '%' or p.full_name ilike '%' || $5 || '%')
      order by r.created_at desc
      limit $6 offset $7`,
    [
      options.status,
      options.bloodGroup,
      options.priority,
      options.city,
      options.search,
      options.limit,
      options.offset,
    ],
  );
  return result.rows;
}

export async function countAdminRequests(
  db: Db,
  options: {
    status: RequestStatus | null;
    bloodGroup: BloodGroup | null;
    priority: RequestPriority | null;
    city: string | null;
    search: string;
  },
): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.blood_requests r
       join public.profiles p on p.id = r.requester_id
      where ($1::public.request_status is null or r.status = $1)
        and ($2::public.blood_group is null or r.blood_group = $2)
        and ($3::public.request_priority is null or r.priority = $3)
        and ($4::text is null or lower(r.hospital_city) = lower($4))
        and ($5 = '' or r.hospital_name ilike '%' || $5 || '%' or p.full_name ilike '%' || $5 || '%')`,
    [options.status, options.bloodGroup, options.priority, options.city, options.search],
  );
  return result.rows[0]?.count ?? 0;
}

/** Finds a likely duplicate active request before hitting the unique index. */
export async function findLikelyDuplicate(
  db: Db,
  options: {
    requesterId: string;
    bloodGroup: BloodGroup;
    hospitalName: string;
    neededBy: string;
  },
): Promise<BloodRequestRow | null> {
  const result = await db.query<BloodRequestRow>(
    `select *
       from public.blood_requests
      where requester_id = $1
        and blood_group = $2
        and status in ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'PARTIALLY_FULFILLED')
        and (needed_by = $4
             or (lower(hospital_name) = lower($3) and created_at > now() - interval '30 minutes'))
      order by created_at desc
      limit 1`,
    [options.requesterId, options.bloodGroup, options.hospitalName, options.neededBy],
  );
  return result.rows[0] ?? null;
}

export async function setRequestUnderReview(
  db: Db,
  id: string,
): Promise<BloodRequestRow | null> {
  const result = await db.query<BloodRequestRow>(
    `update public.blood_requests set status = 'UNDER_REVIEW' where id = $1 returning *`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function setRequestVerified(
  db: Db,
  id: string,
  reviewerId: string,
  reason: string | null,
): Promise<BloodRequestRow | null> {
  const result = await db.query<BloodRequestRow>(
    `update public.blood_requests
        set status = 'VERIFIED',
            reviewed_by = $2,
            reviewed_at = now(),
            review_reason = $3
      where id = $1
      returning *`,
    [id, reviewerId, reason],
  );
  return result.rows[0] ?? null;
}

export async function setRequestRejected(
  db: Db,
  id: string,
  reviewerId: string,
  reason: string,
): Promise<BloodRequestRow | null> {
  const result = await db.query<BloodRequestRow>(
    `update public.blood_requests
        set status = 'REJECTED',
            reviewed_by = $2,
            reviewed_at = now(),
            review_reason = $3
      where id = $1
      returning *`,
    [id, reviewerId, reason],
  );
  return result.rows[0] ?? null;
}

export async function setRequestCancelled(
  db: Db,
  id: string,
  reason: string,
): Promise<BloodRequestRow | null> {
  const result = await db.query<BloodRequestRow>(
    `update public.blood_requests
        set status = 'CANCELLED',
            cancellation_reason = $2,
            cancelled_at = now()
      where id = $1
      returning *`,
    [id, reason],
  );
  return result.rows[0] ?? null;
}

export async function setRequestCompletion(
  db: Db,
  id: string,
  status: 'PARTIALLY_FULFILLED' | 'FULFILLED',
): Promise<BloodRequestRow | null> {
  const result = await db.query<BloodRequestRow>(
    `update public.blood_requests set status = $2 where id = $1 returning *`,
    [id, status],
  );
  return result.rows[0] ?? null;
}

export async function setRequestExpired(
  db: Db,
  id: string,
): Promise<BloodRequestRow | null> {
  const result = await db.query<BloodRequestRow>(
    `update public.blood_requests set status = 'EXPIRED' where id = $1 returning *`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findExpirableRequestIds(
  db: Db,
  limit = 100,
): Promise<Array<{ id: string; status: RequestStatus; requester_id: string; blood_group: BloodGroup }>> {
  const result = await db.query<{
    id: string;
    status: RequestStatus;
    requester_id: string;
    blood_group: BloodGroup;
  }>(
    `select id, status, requester_id, blood_group
       from public.blood_requests
      where status in ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'PARTIALLY_FULFILLED')
        and needed_by < now()
      order by needed_by asc
      limit $1
      for update skip locked`,
    [limit],
  );
  return result.rows;
}

export async function insertRequestHistory(
  db: Db,
  input: {
    requestId: string;
    fromStatus: RequestStatus | null;
    toStatus: RequestStatus;
    actorUserId: string | null;
    reason: string | null;
  },
): Promise<RequestHistoryRow> {
  const result = await db.query<RequestHistoryRow>(
    `insert into public.request_status_history
       (request_id, from_status, to_status, actor_user_id, reason)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [input.requestId, input.fromStatus, input.toStatus, input.actorUserId, input.reason],
  );
  return result.rows[0]!;
}

export interface RequestHistoryWithActor extends RequestHistoryRow {
  actor_name: string | null;
}

export async function listRequestHistory(
  db: Db,
  requestId: string,
): Promise<RequestHistoryWithActor[]> {
  const result = await db.query<RequestHistoryWithActor>(
    `select h.*, p.full_name as actor_name
       from public.request_status_history h
       left join public.profiles p on p.id = h.actor_user_id
      where h.request_id = $1
      order by h.seq asc`,
    [requestId],
  );
  return result.rows;
}

export async function listSuspiciousRequests(db: Db): Promise<SuspiciousRequestRow[]> {
  const result = await db.query<SuspiciousRequestRow>(
    `select ${REQUEST_META_SELECT},
            (select count(*)::int from public.blood_requests r2
              where r2.requester_id = r.requester_id
                and r2.created_at > now() - interval '24 hours') as requests_last_24h,
            (select count(*)::int from public.blood_requests r2
              where r2.requester_id = r.requester_id
                and r2.status = 'REJECTED'
                and r2.updated_at > now() - interval '30 days') as rejected_last_30d,
            (select count(*)::int from public.blood_requests r2
              where r2.requester_id = r.requester_id
                and r2.status in ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'PARTIALLY_FULFILLED')) as active_count
       from public.blood_requests r
       join public.profiles p on p.id = r.requester_id
      where r.status in ('SUBMITTED', 'UNDER_REVIEW', 'REJECTED', 'VERIFIED')
      order by r.created_at desc
      limit 100`,
  );
  return result.rows.filter((row) => {
    const last24h = Number(row.requests_last_24h);
    const rejected30d = Number(row.rejected_last_30d);
    return last24h >= 3 || rejected30d >= 1 || Number(row.active_count) >= 5;
  });
}

export async function requesterRequestSummary(
  db: Db,
  requesterId: string,
): Promise<{
  total: number;
  active: number;
  verified: number;
  fulfilled: number;
  cancelled: number;
  responses_received: number;
}> {
  const result = await db.query<{
    total: number;
    active: number;
    verified: number;
    fulfilled: number;
    cancelled: number;
    responses_received: number;
  }>(
    `select
       count(*)::int as total,
       count(*) filter (where status in ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'PARTIALLY_FULFILLED'))::int as active,
       count(*) filter (where status = 'VERIFIED')::int as verified,
       count(*) filter (where status = 'FULFILLED')::int as fulfilled,
       count(*) filter (where status = 'CANCELLED')::int as cancelled,
       (select count(*)::int from public.donor_responses dr
         join public.blood_requests br on br.id = dr.request_id
        where br.requester_id = $1
          and dr.response_status in ('OFFERED', 'ACCEPTED', 'COMPLETED')) as responses_received
     from public.blood_requests
     where requester_id = $1`,
    [requesterId],
  );
  return (
    result.rows[0] ?? {
      total: 0,
      active: 0,
      verified: 0,
      fulfilled: 0,
      cancelled: 0,
      responses_received: 0,
    }
  );
}

export interface RequesterActivityRow {
  id: string;
  request_id: string;
  hospital_name: string;
  blood_group: BloodGroup;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  reason: string | null;
  created_at: string | Date;
}

export async function recentRequesterActivity(
  db: Db,
  requesterId: string,
  limit = 8,
): Promise<RequesterActivityRow[]> {
  const result = await db.query<RequesterActivityRow>(
    `select h.id, h.request_id, r.hospital_name, r.blood_group,
            h.from_status, h.to_status, h.reason, h.created_at
       from public.request_status_history h
       join public.blood_requests r on r.id = h.request_id
      where r.requester_id = $1
      order by h.created_at desc
      limit $2`,
    [requesterId, limit],
  );
  return result.rows;
}
