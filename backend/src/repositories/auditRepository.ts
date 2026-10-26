import type { Db } from '../db/database.js';
import type { AuditEventRow } from '../types/domain.js';
import { parseJsonObject } from '../lib/serialize.js';
import type { AuditWithNames } from './types.js';

export async function createAuditEvent(
  db: Db,
  input: {
    actorUserId: string | null;
    requestId: string | null;
    eventType: string;
    metadata: Record<string, unknown>;
  },
): Promise<AuditEventRow> {
  const result = await db.query<AuditEventRow>(
    `insert into public.audit_events (actor_user_id, request_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)
     returning *`,
    [input.actorUserId, input.requestId, input.eventType, JSON.stringify(input.metadata)],
  );
  const row = result.rows[0]!;
  return { ...row, metadata: parseJsonObject(row.metadata) };
}

export interface AuditFilters {
  eventType: string | null;
  actorUserId: string | null;
  requestId: string | null;
  limit: number;
  offset: number;
}

export async function listAuditEvents(
  db: Db,
  filters: AuditFilters,
): Promise<AuditWithNames[]> {
  const result = await db.query<AuditWithNames>(
    `select a.*,
            p.full_name as actor_name,
            r.hospital_name as request_hospital_name,
            r.status as request_status
       from public.audit_events a
       left join public.profiles p on p.id = a.actor_user_id
       left join public.blood_requests r on r.id = a.request_id
      where ($1::text is null or a.event_type = $1)
        and ($2::uuid is null or a.actor_user_id = $2)
        and ($3::uuid is null or a.request_id = $3)
      order by a.created_at desc
      limit $4 offset $5`,
    [filters.eventType, filters.actorUserId, filters.requestId, filters.limit, filters.offset],
  );
  return result.rows.map((row) => ({ ...row, metadata: parseJsonObject(row.metadata) }));
}

export async function countAuditEvents(
  db: Db,
  filters: Pick<AuditFilters, 'eventType' | 'actorUserId' | 'requestId'>,
): Promise<number> {
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count
       from public.audit_events
      where ($1::text is null or event_type = $1)
        and ($2::uuid is null or actor_user_id = $2)
        and ($3::uuid is null or request_id = $3)`,
    [filters.eventType, filters.actorUserId, filters.requestId],
  );
  return result.rows[0]?.count ?? 0;
}

/** Hospital-facing audit: own actions plus decisions on requests they reviewed. */
export async function listHospitalAuditEvents(
  db: Db,
  hospitalUserId: string,
  options: { limit: number; offset: number },
): Promise<AuditWithNames[]> {
  const result = await db.query<AuditWithNames>(
    `select a.*,
            p.full_name as actor_name,
            r.hospital_name as request_hospital_name,
            r.status as request_status
       from public.audit_events a
       left join public.profiles p on p.id = a.actor_user_id
       left join public.blood_requests r on r.id = a.request_id
      where a.actor_user_id = $1
         or exists (
           select 1 from public.blood_requests br
           where br.id = a.request_id and br.reviewed_by = $1
         )
      order by a.created_at desc
      limit $2 offset $3`,
    [hospitalUserId, options.limit, options.offset],
  );
  return result.rows.map((row) => ({ ...row, metadata: parseJsonObject(row.metadata) }));
}

export async function hospitalAuditSummary(
  db: Db,
  hospitalUserId: string,
): Promise<{ verified: number; rejected: number }> {
  const result = await db.query<{ verified: number; rejected: number }>(
    `select
       count(*) filter (where event_type = 'REQUEST_VERIFIED')::int as verified,
       count(*) filter (where event_type = 'REQUEST_REJECTED')::int as rejected
     from public.audit_events
     where actor_user_id = $1
       and event_type in ('REQUEST_VERIFIED', 'REQUEST_REJECTED')`,
    [hospitalUserId],
  );
  return result.rows[0] ?? { verified: 0, rejected: 0 };
}
