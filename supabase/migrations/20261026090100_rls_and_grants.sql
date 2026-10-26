-- =============================================================================
-- BloodBridge Part 1 - Row Level Security, grants and helper functions
-- =============================================================================
-- Security model:
--   * The trusted Express API connects with the database owner connection
--     (or Supabase service role) and enforces authorization in services.
--   * Browser clients (role `authenticated`) get deliberately narrow grants.
--     Every mutation that affects verification, lifecycle or audit trails is
--     backend-only. RLS remains the last line of defence.
--   * `anon` receives no application-table privileges.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER avoids recursive RLS evaluation)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_has_role(required public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = required
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_has_role('ADMIN');
$$;

create or replace function public.is_approved_hospital()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_has_role('HOSPITAL')
    and exists (
      select 1
      from public.hospital_profiles hp
      where hp.user_id = auth.uid()
        and hp.verification_status = 'APPROVED'
    );
$$;

revoke all on function public.current_user_has_role(public.app_role) from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_approved_hospital() from public;
grant execute on function public.current_user_has_role(public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved_hospital() to authenticated;

-- ---------------------------------------------------------------------------
-- Reset grants (Supabase grants broad table access by default)
-- ---------------------------------------------------------------------------
revoke all on table
  public.profiles,
  public.user_roles,
  public.donor_profiles,
  public.blood_requests,
  public.request_status_history,
  public.donor_responses,
  public.hospital_profiles,
  public.notifications,
  public.audit_events,
  public.blockchain_transactions
from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.donor_profiles enable row level security;
alter table public.blood_requests enable row level security;
alter table public.request_status_history enable row level security;
alter table public.donor_responses enable row level security;
alter table public.hospital_profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;
alter table public.blockchain_transactions enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select on public.profiles to authenticated;
grant update (full_name, phone_number, city, area, postal_code) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
drop policy if exists user_roles_select_own_or_admin on public.user_roles;
create policy user_roles_select_own_or_admin
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Read-only for browser clients. Role grants happen only through the
-- administrator/service workflow.
grant select on public.user_roles to authenticated;

-- ---------------------------------------------------------------------------
-- donor_profiles
-- ---------------------------------------------------------------------------
drop policy if exists donor_profiles_select_own_or_admin on public.donor_profiles;
create policy donor_profiles_select_own_or_admin
  on public.donor_profiles for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists donor_profiles_insert_own on public.donor_profiles;
create policy donor_profiles_insert_own
  on public.donor_profiles for insert
  to authenticated
  with check (user_id = auth.uid() and public.current_user_has_role('DONOR'));

drop policy if exists donor_profiles_update_own on public.donor_profiles;
create policy donor_profiles_update_own
  on public.donor_profiles for update
  to authenticated
  using (user_id = auth.uid() and public.current_user_has_role('DONOR'))
  with check (user_id = auth.uid() and public.current_user_has_role('DONOR'));

grant select on public.donor_profiles to authenticated;
grant insert (user_id, blood_group, is_available, consent_to_contact, latitude, longitude, privacy_consent_at)
  on public.donor_profiles to authenticated;
grant update (blood_group, is_available, consent_to_contact, latitude, longitude)
  on public.donor_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- blood_requests
-- ---------------------------------------------------------------------------
drop policy if exists blood_requests_select_authorized on public.blood_requests;
create policy blood_requests_select_authorized
  on public.blood_requests for select
  to authenticated
  using (
    requester_id = auth.uid()
    or public.is_admin()
    or public.is_approved_hospital()
    or (status in ('VERIFIED', 'PARTIALLY_FULFILLED') and auth.uid() is not null)
  );

-- No INSERT/UPDATE/DELETE policy: all request mutations flow through the API.
-- Column-level grant deliberately omits requester_contact_phone, exact
-- coordinates and private review notes.
grant select (
  id, requester_id, blood_group, units_requested, hospital_name, hospital_city,
  hospital_area, needed_by, priority, public_message, status, cancellation_reason,
  cancelled_at, reviewed_at, blockchain_audit_key, blockchain_sync_status,
  contact_share_consent, created_at, updated_at
) on public.blood_requests to authenticated;

-- ---------------------------------------------------------------------------
-- request_status_history
-- ---------------------------------------------------------------------------
drop policy if exists request_history_select_authorized on public.request_status_history;
create policy request_history_select_authorized
  on public.request_status_history for select
  to authenticated
  using (
    public.is_admin()
    or public.is_approved_hospital()
    or exists (
      select 1 from public.blood_requests r
      where r.id = request_id and r.requester_id = auth.uid()
    )
  );

grant select (id, request_id, from_status, to_status, actor_user_id, reason, created_at)
  on public.request_status_history to authenticated;

-- ---------------------------------------------------------------------------
-- donor_responses
-- ---------------------------------------------------------------------------
drop policy if exists donor_responses_select_participants on public.donor_responses;
create policy donor_responses_select_participants
  on public.donor_responses for select
  to authenticated
  using (
    donor_id = auth.uid()
    or public.is_admin()
    or public.is_approved_hospital()
    or exists (
      select 1 from public.blood_requests r
      where r.id = request_id and r.requester_id = auth.uid()
    )
  );

-- Responses are written only by the API (notifications, status checks and
-- contact-consent rules cannot be safely re-implemented in a policy).
grant select on public.donor_responses to authenticated;

-- ---------------------------------------------------------------------------
-- hospital_profiles
-- ---------------------------------------------------------------------------
drop policy if exists hospital_profiles_select_own_or_admin on public.hospital_profiles;
create policy hospital_profiles_select_own_or_admin
  on public.hospital_profiles for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Applications and decisions are backend-only.
grant select on public.hospital_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

grant select on public.notifications to authenticated;
-- Recipients may only mark-as-read; they cannot edit the content.
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- audit_events (administrators read; only the trusted API writes)
-- ---------------------------------------------------------------------------
drop policy if exists audit_events_select_admin on public.audit_events;
create policy audit_events_select_admin
  on public.audit_events for select
  to authenticated
  using (public.is_admin());

grant select on public.audit_events to authenticated;

-- ---------------------------------------------------------------------------
-- blockchain_transactions (administrators read; Part 2 service writes)
-- ---------------------------------------------------------------------------
drop policy if exists blockchain_transactions_select_admin on public.blockchain_transactions;
create policy blockchain_transactions_select_admin
  on public.blockchain_transactions for select
  to authenticated
  using (public.is_admin());

grant select on public.blockchain_transactions to authenticated;

-- ---------------------------------------------------------------------------
-- Trusted service role (Supabase API / backend maintenance)
-- ---------------------------------------------------------------------------
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Verification of the design (does not fail a migration, but documents intent)
-- ---------------------------------------------------------------------------
comment on table public.audit_events is
  'Application audit trail. This is NOT a blockchain ledger. Blockchain anchors are recorded in blockchain_transactions.';
comment on table public.blockchain_transactions is
  'Reserved for Part 2 on-chain anchors. Empty in Part 1; never seed fake transactions.';
comment on column public.blood_requests.blockchain_audit_key is
  'Opaque 256-bit random reference generated server-side for future on-chain anchoring.';
