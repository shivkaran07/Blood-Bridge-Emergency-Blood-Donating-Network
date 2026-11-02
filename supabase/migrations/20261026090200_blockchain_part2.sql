-- ---------------------------------------------------------------------------
-- Part 2: wallet ownership + anchored blockchain operations
--
-- 1. wallet_challenges   — single-use, expiring signature challenges
-- 2. wallet_bindings     — privately stored verified wallet ownership
-- 3. blockchain_transactions — new columns for real wallet-submitted anchors
-- 4. NEEDS_RECONCILIATION values on both blockchain enums
-- 5. Row Level Security + grants for the new tables
--
-- The backend (service role) writes these tables; browsers may only read
-- their OWN wallet binding. Challenge rows are never exposed.
-- ---------------------------------------------------------------------------

-- 4. New enum values ( PostgreSQL 12+ allows ALTER TYPE inside a transaction
--    as long as the new values are not used within the same transaction).
alter type public.blockchain_sync_status add value if not exists 'NEEDS_RECONCILIATION';
alter type public.blockchain_transaction_status add value if not exists 'NEEDS_RECONCILIATION';

-- ---------------------------------------------------------------------------
-- 1. wallet_challenges
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  wallet_address text not null,
  nonce_hash text not null,
  message_hash text not null,
  purpose text not null default 'WALLET_BINDING',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint wallet_challenge_address_format check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  constraint wallet_challenge_nonce_hash_format check (nonce_hash ~ '^[a-f0-9]{64}$'),
  constraint wallet_challenge_message_hash_format check (message_hash ~ '^[a-f0-9]{64}$'),
  constraint wallet_challenge_purpose check (purpose in ('WALLET_BINDING')),
  constraint wallet_challenge_expiry_window check (expires_at > created_at)
);

create unique index if not exists wallet_challenges_nonce_unique
  on public.wallet_challenges (nonce_hash);

create index if not exists wallet_challenges_user_idx
  on public.wallet_challenges (user_id, created_at desc);

drop trigger if exists wallet_challenges_purge_old on public.wallet_challenges;

-- ---------------------------------------------------------------------------
-- 2. wallet_bindings — one verified wallet per account, one account per wallet
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_bindings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  wallet_address text not null,
  chain_id bigint not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_binding_address_format check (wallet_address ~ '^0x[0-9a-f]{40}$')
);

-- A wallet may only be owned by one account, and an account owns one wallet.
create unique index if not exists wallet_bindings_wallet_unique
  on public.wallet_bindings (wallet_address);

drop trigger if exists wallet_bindings_set_updated_at on public.wallet_bindings;
create trigger wallet_bindings_set_updated_at
  before update on public.wallet_bindings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. blockchain_transactions: wallet-provided anchor details
-- ---------------------------------------------------------------------------
alter table public.blockchain_transactions
  add column if not exists source_address text,
  add column if not exists error_message text,
  add column if not exists confirmed_at timestamptz;

alter table public.blockchain_transactions
  add constraint blockchain_tx_source_address_format check (
    source_address is null or source_address ~ '^0x[0-9a-f]{40}$'
  );

-- At most one open operation per (request, action): prevents duplicate
-- wallet submissions for the same decision.
create unique index if not exists blockchain_tx_open_operation_unique
  on public.blockchain_transactions (request_id, action)
  where transaction_status in ('PENDING', 'SUBMITTED');

create index if not exists blockchain_tx_actor_idx
  on public.blockchain_transactions (actor_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.wallet_challenges enable row level security;
alter table public.wallet_bindings enable row level security;

-- Challenges are backend-internal: no policy is created for anon/authenticated.
drop policy if exists wallet_challenges_select_admin on public.wallet_challenges;
create policy wallet_challenges_select_admin
  on public.wallet_challenges for select
  to authenticated
  using (public.is_admin());

-- A user may read their own binding (wallet status screen) — nothing else.
drop policy if exists wallet_bindings_select_own on public.wallet_bindings;
create policy wallet_bindings_select_own
  on public.wallet_bindings for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.wallet_bindings to authenticated;
revoke all on public.wallet_challenges from anon, authenticated;

comment on table public.wallet_challenges is
  'Single-use, expiring wallet-ownership challenges. Nonces are stored hashed; rows are never updated after consumption.';
comment on table public.wallet_bindings is
  'Privately stored verified wallet ownership. Never grants privileges by itself: on-chain VERIFIER_ROLE is granted separately by the contract administrator.';
