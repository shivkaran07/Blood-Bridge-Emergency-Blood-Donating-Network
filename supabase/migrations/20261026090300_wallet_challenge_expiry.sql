-- Expired challenges must remain updateable for replay/expiry tests and cleanup.
-- The service enforces the configured short TTL when it creates each challenge;
-- this table constraint incorrectly prevented an existing challenge expiring.
alter table public.wallet_challenges
  drop constraint if exists wallet_challenge_expiry_window;

comment on column public.wallet_challenges.expires_at is
  'Short-lived wallet challenge deadline; past deadlines are valid persisted state.';
