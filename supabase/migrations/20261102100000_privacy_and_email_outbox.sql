-- Privacy controls and opt-in email delivery.
alter table public.profiles
  add column if not exists email_notifications_enabled boolean not null default false;

alter table public.blood_requests
  alter column requester_contact_phone drop not null;

alter table public.blood_requests
  drop constraint if exists blood_requests_contact_length;

alter table public.blood_requests
  add constraint blood_requests_contact_length
  check (
    requester_contact_phone is null
    or char_length(requester_contact_phone) between 7 and 20
  );

create table if not exists public.notification_email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique
    references public.notifications (id) on delete cascade,
  status text not null default 'PENDING',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_email_outbox_status
    check (status in ('PENDING', 'SENDING', 'SENT', 'FAILED', 'EXPIRED')),
  constraint notification_email_outbox_attempts
    check (attempt_count between 0 and 5),
  constraint notification_email_outbox_sent
    check (status <> 'SENT' or sent_at is not null)
);

create index if not exists notification_email_outbox_due_idx
  on public.notification_email_outbox (next_attempt_at, created_at)
  where status in ('PENDING', 'SENDING');

drop trigger if exists notification_email_outbox_set_updated_at
  on public.notification_email_outbox;
create trigger notification_email_outbox_set_updated_at
  before update on public.notification_email_outbox
  for each row execute function public.set_updated_at();

alter table public.notification_email_outbox enable row level security;
