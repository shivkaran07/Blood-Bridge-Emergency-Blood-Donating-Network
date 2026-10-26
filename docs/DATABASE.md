# Database

The schema is defined by two version-controlled migrations:

1. `supabase/migrations/20261026090000_core_schema.sql` — enums, tables, constraints, indexes and
   the signup trigger.
2. `supabase/migrations/20261026090100_rls_and_grants.sql` — helper functions, Row Level Security,
   policies and column-level grants.

Apply them with `npm run migrate -w backend` or `supabase db push`. See README §7.

---

## 1. Entity relationships

```
auth.users 1──1 profiles 1──* user_roles
                    │
                    ├──1 donor_profiles
                    ├──1 hospital_profiles
                    ├──* blood_requests (requester)
                    │      ├──* request_status_history
                    │      ├──* donor_responses ──* profiles (donor)
                    │      ├──* notifications (optional relation)
                    │      ├──* audit_events (optional relation)
                    │      └──* blockchain_transactions
                    └──* notifications (recipient)
```

- `profiles.id` is the Supabase Auth user ID, so there is no separate password store.
- `user_roles` is the authoritative role source. JWT metadata is never trusted for privileges.
- `hospital_profiles.user_id` is unique: one institutional application per account.
- Deleting an auth user cascades to their profile, roles, donor/hospital profile, responses and
  notifications. Requests use `on delete restrict` to protect history.
- `audit_events` uses `on delete set null` for actor and request so the event survives.
- `blockchain_transactions` currently has no writer in the application. It exists for Part 2.

---

## 2. Enumerated types

| Type | Values |
| --- | --- |
| `app_role` | `REQUESTER`, `DONOR`, `HOSPITAL`, `ADMIN` |
| `account_status` | `ACTIVE`, `SUSPENDED` |
| `blood_group` | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| `request_priority` | `NORMAL`, `URGENT`, `CRITICAL` |
| `request_status` | `SUBMITTED`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `CANCELLED`, `EXPIRED` |
| `response_status` | `OFFERED`, `ACCEPTED`, `DECLINED`, `WITHDRAWN`, `COMPLETED`, `CANCELLED` |
| `hospital_verification_status` | `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED` |
| `blockchain_sync_status` | `NOT_SCHEDULED`, `AWAITING_WALLET`, `SUBMITTED`, `CONFIRMED`, `FAILED` |
| `blockchain_transaction_status` | `PENDING`, `SUBMITTED`, `CONFIRMED`, `FAILED` |

---

## 3. Tables

### `profiles`
One row per authenticated user.

| Column | Notes |
| --- | --- |
| `id` | PK, FK → `auth.users.id`, cascade delete |
| `full_name` | ≤ 120 chars |
| `phone_number` | private, 7–20 chars when present |
| `city`, `area`, `postal_code` | general location only |
| `account_status` | `ACTIVE` / `SUSPENDED` |
| `created_at`, `updated_at` | trigger-maintained |

### `user_roles`
Authoritative role assignments. Unique `(user_id, role)`. `granted_by` records the administrator
where applicable (null for the break-glass script).

### `donor_profiles`
| Column | Notes |
| --- | --- |
| `user_id` | PK, FK → `profiles` |
| `blood_group` | required |
| `is_available` | donor-controlled |
| `consent_to_contact` | required for coordinates and contact sharing |
| `latitude`, `longitude` | optional pair, range-checked |
| `privacy_consent_at` | records consent time |

Constraints: coordinates must be both present or both absent, and coordinates require
`consent_to_contact = true`.

### `blood_requests`
Core request record. Notable columns:

- request content: `blood_group`, `units_requested` (1–20), `hospital_name`, `hospital_city`,
  `hospital_area`, optional hospital coordinates, `needed_by`, `priority`, `public_message`.
- contact: `requester_contact_phone`, `contact_share_consent`.
- lifecycle: `status`, `cancellation_reason`, `cancelled_at`, `reviewed_by`, `reviewed_at`,
  `review_reason`.
- blockchain seam: `blockchain_audit_key` (64 lowercase hex chars, unique, generated with
  `crypto.randomBytes(32)`), `blockchain_sync_status` default `NOT_SCHEDULED`.

Constraints include:
- units range and text lengths,
- audit-key format and uniqueness,
- cancelled status requires a reason and timestamp,
- reviewed timestamp requires a reviewer,
- unique active duplicate index on
  `(requester_id, blood_group, hospital_name, needed_by)` for non-terminal statuses.

### `request_status_history`
Append-only trail with monotonic `seq` identity. Records `from_status`, `to_status`, actor, reason
and timestamp. Indexed by request and sequence.

### `donor_responses`
One row per donor offer. `response_status` defaults to `OFFERED`.

A partial unique index permits at most **one active response** per `(request_id, donor_id)` where
status is `OFFERED`, `ACCEPTED` or `COMPLETED`. Withdrawn, declined and cancelled rows remain as
history and allow a new offer later.

### `hospital_profiles`
Institutional application and verification record. Unique `user_id` and unique
`registration_number`. Approval requires `verified_by` and `verified_at`. Optional
`verified_wallet_address` is format-checked (`0x` + 40 hex) for Part 2.

### `notifications`
Recipient-scoped in-app notice with a constrained `notification_type`, title, message, optional
related request and `read_at`. Indexed for recipient timeline and unread lookup.

### `audit_events`
Application audit trail (not a blockchain ledger): nullable actor and request, `event_type`,
non-sensitive JSON object metadata, timestamp. Indexed by request, actor and creation time.

### `blockchain_transactions`
Part 2 scaffold: request, audit key, network name, chain ID, contract address, transaction hash,
action, status, block number, actor, timestamps.

Constraints:
- hash format `0x` + 64 hex when present,
- contract format `0x` + 40 hex,
- `CONFIRMED` requires both a hash and a block number,
- unique non-null transaction hash.

Part 1 inserts **no rows**. The UI must show an empty state, not fabricated transactions.

### `schema_migrations`
Runner bookkeeping created by `backend/src/db/migrate.ts`; RLS enabled and browser grants revoked.

---

## 4. Triggers and functions

| Object | Purpose |
| --- | --- |
| `set_updated_at()` | maintains `updated_at` on mutable tables |
| `handle_new_user()` | `SECURITY DEFINER` trigger on `auth.users`; creates profile and a base role from trusted metadata |
| `current_user_has_role(role)` | RLS helper, `SECURITY DEFINER` to avoid recursive policy evaluation |
| `is_admin()` | role helper |
| `is_approved_hospital()` | requires `HOSPITAL` role **and** an `APPROVED` hospital profile |

The signup trigger accepts `full_name` and `account_type` metadata. `account_type` is uppercased and
restricted to `REQUESTER`/`DONOR`; anything else falls back to `REQUESTER`. It cannot grant
`HOSPITAL` or `ADMIN`.

---

## 5. Row Level Security

RLS is enabled on **every** application table. Browser roles (`anon`, `authenticated`) receive
broad grants revoked first, then narrow column grants.

| Table | Browser capability |
| --- | --- |
| `profiles` | select own or admin; update own permitted columns |
| `user_roles` | select own or admin; read-only |
| `donor_profiles` | select own or admin; insert/update own only when the caller has `DONOR` |
| `blood_requests` | select if owner, admin, approved hospital, or any authenticated user for verified/partially fulfilled requests; **no browser writes**; phone and exact coordinates excluded from column grant |
| `request_status_history` | select for owner, admin or approved hospital; no writes |
| `donor_responses` | select only for the request owner, the donor, an approved hospital or admin; no browser writes |
| `hospital_profiles` | select own or admin; no browser writes |
| `notifications` | select/update own only |
| `audit_events` | select for admins only; no writes |
| `blockchain_transactions` | select for admins only; no writes |

The Express API connects with server credentials and enforces the real authorization rules in
services. RLS is a second layer that limits direct PostgREST/browser access. It is not a substitute
for service checks, and service checks are not a substitute for RLS.

### Why some mutations are API-only
Request creation, lifecycle changes, donor responses, hospital decisions, role grants, audit
events and blockchain records require cross-table invariants, notifications and actor checks. All
of these are backend-only. Allowing browser writes would create bypass paths and inconsistent
history.

---

## 6. Migration rules

- Migrations are ordered by filename and applied once.
- Each file runs in a transaction; failure rolls back that file.
- Do not edit an applied migration on a shared database; add a new timestamped migration instead.
- If you use the Supabase CLI instead of the project runner, keep `schema_migrations` consistent.
- Test migrations against the PGlite suite before applying to a hosted project.

---

## 7. Data hygiene

- Never place real patient data in development or tests.
- Do not store passwords or auth tokens in application tables.
- Keep audit metadata non-sensitive.
- Back up a hosted database before applying schema changes.
- The application has no destructive reset script.
