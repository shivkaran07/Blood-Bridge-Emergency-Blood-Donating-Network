import type { Db } from '../db/database.js';
import type { BloodGroup, RequestPriority, RequestStatus } from '../types/domain.js';

export interface AdminStats {
  total_users: number;
  active_users: number;
  suspended_users: number;
  donors: number;
  hospital_users: number;
  admins: number;
  total_requests: number;
  submitted_requests: number;
  under_review_requests: number;
  verified_requests: number;
  rejected_requests: number;
  fulfilled_requests: number;
  cancelled_requests: number;
  expired_requests: number;
  active_requests: number;
  total_responses: number;
  offered_responses: number;
  accepted_responses: number;
  pending_hospitals: number;
  approved_hospitals: number;
  anchors_not_scheduled: number;
}

export async function getAdminStats(db: Db): Promise<AdminStats> {
  const result = await db.query<AdminStats>(
    `select
       (select count(*)::int from public.profiles) as total_users,
       (select count(*)::int from public.profiles where account_status = 'ACTIVE') as active_users,
       (select count(*)::int from public.profiles where account_status = 'SUSPENDED') as suspended_users,
       (select count(*)::int from public.user_roles where role = 'DONOR') as donors,
       (select count(*)::int from public.user_roles where role = 'HOSPITAL') as hospital_users,
       (select count(*)::int from public.user_roles where role = 'ADMIN') as admins,
       (select count(*)::int from public.blood_requests) as total_requests,
       (select count(*)::int from public.blood_requests where status = 'SUBMITTED') as submitted_requests,
       (select count(*)::int from public.blood_requests where status = 'UNDER_REVIEW') as under_review_requests,
       (select count(*)::int from public.blood_requests where status = 'VERIFIED') as verified_requests,
       (select count(*)::int from public.blood_requests where status = 'REJECTED') as rejected_requests,
       (select count(*)::int from public.blood_requests where status = 'FULFILLED') as fulfilled_requests,
       (select count(*)::int from public.blood_requests where status = 'CANCELLED') as cancelled_requests,
       (select count(*)::int from public.blood_requests where status = 'EXPIRED') as expired_requests,
       (select count(*)::int from public.blood_requests
         where status in ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'PARTIALLY_FULFILLED')) as active_requests,
       (select count(*)::int from public.donor_responses) as total_responses,
       (select count(*)::int from public.donor_responses where response_status = 'OFFERED') as offered_responses,
       (select count(*)::int from public.donor_responses where response_status = 'ACCEPTED') as accepted_responses,
       (select count(*)::int from public.hospital_profiles where verification_status = 'PENDING') as pending_hospitals,
       (select count(*)::int from public.hospital_profiles where verification_status = 'APPROVED') as approved_hospitals,
       (select count(*)::int from public.blood_requests
         where status = 'VERIFIED' and blockchain_sync_status = 'NOT_SCHEDULED') as anchors_not_scheduled`,
  );
  return result.rows[0]!;
}

export interface AdminRequestFilterOptions {
  status: RequestStatus | null;
  bloodGroup: BloodGroup | null;
  priority: RequestPriority | null;
  city: string | null;
  search: string;
}

export async function countRequestsByStatus(db: Db): Promise<Array<{ status: RequestStatus; count: number }>> {
  const result = await db.query<{ status: RequestStatus; count: number }>(
    `select status, count(*)::int as count
       from public.blood_requests
      group by status`,
  );
  return result.rows;
}

export async function activityByDay(
  db: Db,
  days = 7,
): Promise<Array<{ day: string; requests: number; responses: number }>> {
  const result = await db.query<{ day: string; requests: number; responses: number }>(
    `with series as (
       select generate_series(
         current_date - ($1::int - 1),
         current_date,
         interval '1 day'
       )::date as day
     )
     select to_char(s.day, 'YYYY-MM-DD') as day,
            (select count(*)::int from public.blood_requests r where r.created_at::date = s.day) as requests,
            (select count(*)::int from public.donor_responses d where d.created_at::date = s.day) as responses
       from series s
      order by s.day asc`,
    [days],
  );
  return result.rows;
}
