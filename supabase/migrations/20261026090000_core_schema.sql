-- =============================================================================
-- BloodBridge Part 1 - core schema
-- =============================================================================
-- This migration creates the application data model. It is written to be
-- safe to run through either:
--   * the Supabase CLI (supabase db push), or
--   * the project's own migration runner (npm run migrate -w backend).
--
-- Supabase owns the `auth` schema. The signup trigger below attaches to
-- auth.users and must be created by a role with rights on that schema.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enumerated types (guarded so the file can be re-applied if necessary)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('REQUESTER', 'DONOR', 'HOSPITAL', 'ADMIN');
  end if;

  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('ACTIVE', 'SUSPENDED');
  end if;

  if not exists (select 1 from pg_type where typname = 'blood_group') then
    create type public.blood_group as enum ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
  end if;

  if not exists (select 1 from pg_type where typname = 'request_priority') then
    create type public.request_priority as enum ('NORMAL', 'URGENT', 'CRITICAL');
  end if;

  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum (
      'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED',
      'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'EXPIRED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'response_status') then
    create type public.response_status as enum (
      'OFFERED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'COMPLETED', 'CANCELLED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'hospital_verification_status') then
    create type public.hospital_verification_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
  end if;

  if not exists (select 1 from pg_type where typname = 'blockchain_sync_status') then
    create type public.blockchain_sync_status as enum (
      'NOT_SCHEDULED', 'AWAITING_WALLET', 'SUBMITTED', 'CONFIRMED', 'FAILED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'blockchain_transaction_status') then
    create type public.blockchain_transaction_status as enum ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles  (one row per authenticated Supabase user)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone_number text,
  city text,
  area text,
  postal_code text,
  account_status public.account_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 120),
  constraint profiles_phone_length check (phone_number is null or char_length(phone_number) between 7 and 20),
  constraint profiles_city_length check (city is null or char_length(city) <= 100),
  constraint profiles_area_length check (area is null or char_length(area) <= 120),
  constraint profiles_postal_length check (postal_code is null or char_length(postal_code) <= 16)
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_roles  (authoritative application roles; never derived from JWT metadata)
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_roles_unique unique (user_id, role)
);

create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role);

-- ---------------------------------------------------------------------------
-- donor_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.donor_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  blood_group public.blood_group not null,
  is_available boolean not null default false,
  consent_to_contact boolean not null default false,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  privacy_consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donor_latitude_range check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint donor_longitude_range check (longitude is null or (longitude >= -180 and longitude <= 180)),
  constraint donor_coords_pair check (
    (latitude is null and longitude is null) or (latitude is not null and longitude is not null)
  ),
  constraint donor_coords_require_consent check (latitude is null or consent_to_contact)
);

drop trigger if exists donor_profiles_set_updated_at on public.donor_profiles;
create trigger donor_profiles_set_updated_at
  before update on public.donor_profiles
  for each row execute function public.set_updated_at();

create index if not exists donor_profiles_match_idx
  on public.donor_profiles (blood_group, is_available, consent_to_contact);

-- ---------------------------------------------------------------------------
-- blood_requests
-- ---------------------------------------------------------------------------
create table if not exists public.blood_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete restrict,
  blood_group public.blood_group not null,
  units_requested integer not null,
  hospital_name text not null,
  hospital_city text not null,
  hospital_area text not null,
  hospital_latitude numeric(9, 6),
  hospital_longitude numeric(9, 6),
  needed_by timestamptz not null,
  priority public.request_priority not null default 'NORMAL',
  public_message text,
  requester_contact_phone text not null,
  contact_share_consent boolean not null default true,
  status public.request_status not null default 'SUBMITTED',
  cancellation_reason text,
  cancelled_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_reason text,
  blockchain_audit_key text not null,
  blockchain_sync_status public.blockchain_sync_status not null default 'NOT_SCHEDULED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blood_requests_units_range check (units_requested between 1 and 20),
  constraint blood_requests_hospital_name_length check (char_length(hospital_name) between 2 and 160),
  constraint blood_requests_city_length check (char_length(hospital_city) between 2 and 100),
  constraint blood_requests_area_length check (char_length(hospital_area) between 2 and 120),
  constraint blood_requests_message_length check (public_message is null or char_length(public_message) <= 500),
  constraint blood_requests_contact_length check (char_length(requester_contact_phone) between 7 and 20),
  constraint blood_requests_review_reason_length check (review_reason is null or char_length(review_reason) <= 500),
  constraint blood_requests_cancel_reason_length check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  constraint blood_requests_audit_key_format check (blockchain_audit_key ~ '^[a-f0-9]{64}$'),
  constraint blood_requests_latitude_range check (hospital_latitude is null or (hospital_latitude >= -90 and hospital_latitude <= 90)),
  constraint blood_requests_longitude_range check (hospital_longitude is null or (hospital_longitude >= -180 and hospital_longitude <= 180)),
  constraint blood_requests_coords_pair check (
    (hospital_latitude is null and hospital_longitude is null)
    or (hospital_latitude is not null and hospital_longitude is not null)
  ),
  constraint blood_requests_audit_key_unique unique (blockchain_audit_key),
  constraint blood_requests_cancelled_fields check (
    status <> 'CANCELLED' or (cancelled_at is not null and cancellation_reason is not null)
  ),
  constraint blood_requests_review_fields check (
    reviewed_at is null or reviewed_by is not null
  )
);

drop trigger if exists blood_requests_set_updated_at on public.blood_requests;
create trigger blood_requests_set_updated_at
  before update on public.blood_requests
  for each row execute function public.set_updated_at();

-- A requester cannot create two identical active requests. The service layer
-- produces a friendly 409; this index is the race-safe backstop.
create unique index if not exists blood_requests_active_duplicate_idx
  on public.blood_requests (requester_id, blood_group, hospital_name, needed_by)
  where status in ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'PARTIALLY_FULFILLED');

create index if not exists blood_requests_status_idx on public.blood_requests (status);
create index if not exists blood_requests_requester_idx on public.blood_requests (requester_id, created_at desc);
create index if not exists blood_requests_feed_idx
  on public.blood_requests (blood_group, status, needed_by);
create index if not exists blood_requests_city_idx on public.blood_requests (lower(hospital_city));

-- ---------------------------------------------------------------------------
-- request_status_history  (append-only lifecycle trail)
-- ---------------------------------------------------------------------------
create table if not exists public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  request_id uuid not null references public.blood_requests (id) on delete cascade,
  from_status public.request_status,
  to_status public.request_status not null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  constraint request_history_reason_length check (reason is null or char_length(reason) <= 500)
);

create index if not exists request_history_request_idx
  on public.request_status_history (request_id, seq asc);

-- ---------------------------------------------------------------------------
-- donor_responses
-- ---------------------------------------------------------------------------
create table if not exists public.donor_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.blood_requests (id) on delete cascade,
  donor_id uuid not null references public.profiles (id) on delete cascade,
  response_status public.response_status not null default 'OFFERED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists donor_responses_set_updated_at on public.donor_responses;
create trigger donor_responses_set_updated_at
  before update on public.donor_responses
  for each row execute function public.set_updated_at();

-- At most one *active* response per donor per request.
create unique index if not exists donor_responses_active_unique_idx
  on public.donor_responses (request_id, donor_id)
  where response_status in ('OFFERED', 'ACCEPTED', 'COMPLETED');

create index if not exists donor_responses_request_idx on public.donor_responses (request_id);
create index if not exists donor_responses_donor_idx on public.donor_responses (donor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- hospital_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.hospital_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  hospital_name text not null,
  registration_number text not null unique,
  contact_person text not null,
  contact_phone text not null,
  official_email text not null,
  address text not null,
  city text not null,
  area text not null,
  verification_status public.hospital_verification_status not null default 'PENDING',
  review_reason text,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  verified_wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hospital_name_length check (char_length(hospital_name) between 2 and 160),
  constraint hospital_registration_length check (char_length(registration_number) between 3 and 80),
  constraint hospital_contact_person_length check (char_length(contact_person) between 2 and 120),
  constraint hospital_contact_phone_length check (char_length(contact_phone) between 7 and 20),
  constraint hospital_email_length check (char_length(official_email) between 5 and 160),
  constraint hospital_address_length check (char_length(address) between 5 and 300),
  constraint hospital_city_length check (char_length(city) between 2 and 100),
  constraint hospital_area_length check (char_length(area) between 2 and 120),
  constraint hospital_review_reason_length check (review_reason is null or char_length(review_reason) <= 500),
  constraint hospital_approval_fields check (
    verification_status <> 'APPROVED' or (verified_by is not null and verified_at is not null)
  ),
  constraint hospital_wallet_format check (
    verified_wallet_address is null or verified_wallet_address ~ '^0x[a-fA-F0-9]{40}$'
  )
);

drop trigger if exists hospital_profiles_set_updated_at on public.hospital_profiles;
create trigger hospital_profiles_set_updated_at
  before update on public.hospital_profiles
  for each row execute function public.set_updated_at();

create index if not exists hospital_profiles_status_idx
  on public.hospital_profiles (verification_status, created_at);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  related_request_id uuid references public.blood_requests (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (notification_type in (
    'REQUEST_SUBMITTED', 'REQUEST_UNDER_REVIEW', 'REQUEST_VERIFIED', 'REQUEST_REJECTED',
    'DONOR_RESPONSE_RECEIVED', 'DONOR_RESPONSE_ACCEPTED', 'DONOR_RESPONSE_DECLINED',
    'RESPONSE_WITHDRAWN', 'RESPONSE_COMPLETED',
    'REQUEST_CANCELLED', 'REQUEST_PARTIALLY_FULFILLED', 'REQUEST_FULFILLED', 'REQUEST_EXPIRED',
    'HOSPITAL_APPLICATION_SUBMITTED', 'HOSPITAL_APPLICATION_APPROVED', 'HOSPITAL_APPLICATION_REJECTED',
    'ACCOUNT_SUSPENDED', 'ACCOUNT_REACTIVATED', 'BLOCKCHAIN_SYNC_ISSUE'
  )),
  constraint notifications_title_length check (char_length(title) between 1 and 160),
  constraint notifications_message_length check (char_length(message) between 1 and 1000)
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- audit_events  (application audit trail; not a blockchain ledger)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  request_id uuid references public.blood_requests (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_event_type_length check (char_length(event_type) between 3 and 80),
  constraint audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists audit_events_request_idx on public.audit_events (request_id, created_at desc);
create index if not exists audit_events_actor_idx on public.audit_events (actor_user_id, created_at desc);
create index if not exists audit_events_created_idx on public.audit_events (created_at desc);

-- ---------------------------------------------------------------------------
-- blockchain_transactions  (reserved for Part 2; deliberately empty in Part 1)
-- ---------------------------------------------------------------------------
create table if not exists public.blockchain_transactions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.blood_requests (id) on delete cascade,
  blockchain_audit_key text not null,
  network_name text not null,
  chain_id bigint not null,
  contract_address text not null,
  transaction_hash text,
  action text not null,
  transaction_status public.blockchain_transaction_status not null default 'PENDING',
  block_number bigint,
  actor_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blockchain_tx_hash_format check (
    transaction_hash is null or transaction_hash ~ '^0x[a-fA-F0-9]{64}$'
  ),
  constraint blockchain_tx_contract_format check (contract_address ~ '^0x[a-fA-F0-9]{40}$'),
  constraint blockchain_tx_audit_key_format check (blockchain_audit_key ~ '^[a-f0-9]{64}$'),
  constraint blockchain_tx_block_number_positive check (block_number is null or block_number >= 0),
  constraint blockchain_tx_confirmed_fields check (
    transaction_status <> 'CONFIRMED' or (transaction_hash is not null and block_number is not null)
  )
);

create unique index if not exists blockchain_tx_hash_unique_idx
  on public.blockchain_transactions (transaction_hash)
  where transaction_hash is not null;

drop trigger if exists blockchain_transactions_set_updated_at on public.blockchain_transactions;
create trigger blockchain_transactions_set_updated_at
  before update on public.blockchain_transactions
  for each row execute function public.set_updated_at();

create index if not exists blockchain_tx_request_idx
  on public.blockchain_transactions (request_id, created_at desc);
create index if not exists blockchain_tx_status_idx
  on public.blockchain_transactions (transaction_status);

-- ---------------------------------------------------------------------------
-- Signup bootstrap: create profile + base roles from trusted server-provided
-- Supabase metadata. Only non-privileged roles can ever be granted here.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  fallback_name text := coalesce(nullif(new.email, ''), 'New user');
  desired_type text := upper(coalesce(meta ->> 'account_type', 'REQUESTER'));
begin
  insert into public.profiles (id, full_name, phone_number, city, area)
  values (
    new.id,
    coalesce(nullif(meta ->> 'full_name', ''), split_part(fallback_name, '@', 1)),
    nullif(meta ->> 'phone_number', ''),
    nullif(meta ->> 'city', ''),
    nullif(meta ->> 'area', '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'REQUESTER')
  on conflict (user_id, role) do nothing;

  if desired_type = 'DONOR' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'DONOR')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Defense in depth: even if a future grant is too broad, a browser session
-- must not be able to change privileged profile/role/hospital fields.
-- The trusted backend connects as a database role without JWT claims, so
-- auth.uid() is null there.
-- ---------------------------------------------------------------------------
create or replace function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.account_status is distinct from old.account_status then
    raise exception 'account_status cannot be changed by the account owner';
  end if;
  if auth.uid() is not null and new.id is distinct from old.id then
    raise exception 'profile id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_fields on public.profiles;
create trigger profiles_protect_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_fields();

create or replace function public.protect_privileged_roles()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.role in ('ADMIN', 'HOSPITAL') then
    raise exception 'privileged roles cannot be self-assigned';
  end if;
  return new;
end;
$$;

drop trigger if exists user_roles_protect_privileged on public.user_roles;
create trigger user_roles_protect_privileged
  before insert or update on public.user_roles
  for each row execute function public.protect_privileged_roles();

create or replace function public.protect_hospital_verification_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and (
    new.verification_status is distinct from old.verification_status
    or new.verified_by is distinct from old.verified_by
    or new.verified_at is distinct from old.verified_at
    or new.verified_wallet_address is distinct from old.verified_wallet_address
  ) then
    raise exception 'hospital verification fields can only be changed by an administrator workflow';
  end if;
  return new;
end;
$$;

drop trigger if exists hospital_profiles_protect_verification on public.hospital_profiles;
create trigger hospital_profiles_protect_verification
  before update on public.hospital_profiles
  for each row execute function public.protect_hospital_verification_fields();
