# Architecture

## 1. Goals and boundaries

BloodBridge Part 1 is a working coordination application. The architectural priorities are:

1. **Server-side authorization.** The browser is never the security boundary.
2. **A recorded lifecycle.** Request and response transitions are validated centrally and retained
   in history.
3. **Consent-based disclosure.** Contact information is revealed only when both permission and
   consent conditions hold.
4. **Honest trust claims.** Database verification is labelled as such. No blockchain transaction is
   simulated.
5. **A clean Part 2 seam.** Audit keys, synchronization states and transaction records already
   exist, so the chain integration can be added without reshaping the domain.

Non-goals: clinical decision support, blood inventory management, dispatch, donor medical
screening, guaranteed availability.

---

## 2. Runtime topology

```
┌──────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│  React + Vite + TypeScript + Tailwind + TanStack Query       │
│  Supabase JS client: authentication only                     │
└───────────────┬──────────────────────────┬───────────────────┘
                │ JWT (Authorization)      │ publishable key
                v                          v
┌───────────────────────────────┐   ┌──────────────────────────┐
│ Express API /api/v1           │   │ Supabase Auth            │
│  helmet, cors, rate limits    │   │  email/password sessions │
│  token verification           │   └──────────────────────────┘
│  Zod validation               │
│  services + repositories      │
└───────────────┬───────────────┘
                │ pg connection (server credentials)
                v
┌──────────────────────────────────────────────────────────────┐
│ Supabase PostgreSQL                                          │
│  application tables + RLS + audit + blockchain scaffold      │
└──────────────────────────────────────────────────────────────┘
```

The frontend never uses `supabase.from(...)` for application tables. Business reads and writes go
through the API so authorization and invariants cannot be bypassed. RLS remains a second layer for
direct database access.

---

## 3. Backend structure

| Layer | Responsibility |
| --- | --- |
| `routes/` | URL surface, rate limiters and role middleware placement |
| `middleware/` | authentication, authorization, Zod validation, error mapping, rate limiting |
| `controllers/` | parse request context, call a service, send a consistent JSON response |
| `schemas/` | input validation and normalization |
| `services/` | business rules, transition checks, notifications, audit writes |
| `repositories/` | parameterized SQL and row mapping |
| `db/` | connection adapter (`pg` in production, PGlite in tests), migration runner |
| `lib/` | errors, crypto, logger, serialization helpers |
| `types/` | domain enums and row/DTO types |

Controllers stay thin. A service owns the transaction boundary for a workflow (for example: insert
request + history + audit + notification). Repositories never make authorization decisions.

### Error model

- Typed errors: `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`,
  `ConflictError`, `RateLimitError`.
- Every API response is either `{ "data": ... }` or
  `{ "error": { "code", "message", "details?" }, "requestId"? }`.
- Unexpected errors become a generic 500 message; technical detail stays in development logs.
- Unknown resources visible to unauthorized users are returned as `404` where appropriate, to avoid
  leaking existence.

### Logging

- pino structured logs.
- Request IDs are attached and returned for diagnosis.
- Authorization headers, cookies, tokens and sensitive request bodies are redacted.
- Audit events contain non-sensitive metadata only.

---

## 4. Authentication and identity

1. The browser signs in with Supabase Auth (`signInWithPassword`, `signUp`).
2. Supabase persists the session and refreshes the access token.
3. `AuthContext` exposes the current token and loads `/api/v1/me`.
4. The backend verifies the bearer token with Supabase (`auth.getUser`) and loads the user's roles
   from `public.user_roles` plus profile/account status.
5. Suspended accounts are rejected server-side.
6. Role changes require re-authentication or a profile refresh to be observed.

Registration metadata includes `full_name` and `account_type` (`REQUESTER` or `DONOR`). The signup
trigger can create only those two roles. `HOSPITAL` is granted during an administrator decision.
`ADMIN` is provisioned by the documented break-glass script.

---

## 5. Request lifecycle

`services/statusMachine.ts` is the single source of truth:

```
SUBMITTED        -> UNDER_REVIEW | CANCELLED | EXPIRED
UNDER_REVIEW     -> VERIFIED | REJECTED | CANCELLED | EXPIRED
VERIFIED         -> PARTIALLY_FULFILLED | FULFILLED | CANCELLED | EXPIRED
PARTIALLY_FULFILLED -> FULFILLED | EXPIRED
REJECTED, FULFILLED, CANCELLED, EXPIRED -> terminal
```

Rules enforced in services:

- Only an approved hospital verifier may claim, verify or reject.
- A verifier cannot review their own request.
- Verifying or rejecting a `SUBMITTED` request first records `SUBMITTED -> UNDER_REVIEW`, then the
  decision, so the history is complete.
- Only the owner or an administrator may cancel (within cancellable statuses) or record completion.
- Each change writes `request_status_history` and an audit event.
- Notifications are created for the requester and affected donors.

Initial creation flow:

1. Validate input (Zod).
2. Confirm the authenticated user and account status.
3. Apply rate limits.
4. Detect a likely duplicate active request.
5. Generate a UUID request ID and a cryptographically random audit key.
6. Insert `SUBMITTED` request + history + audit event + notification.
7. Initialize `blockchain_sync_status = NOT_SCHEDULED`.
8. Return the real DTO and status.

The audit key is opaque and contains no personal data. It is suitable for later on-chain anchoring.

---

## 6. Matching

`requestService` computes authorized match results:

- Same **exact recorded blood group** (not a compatibility matrix).
- Donor `is_available = true`.
- Donor `consent_to_contact = true`.
- Request is `VERIFIED` or `PARTIALLY_FULFILLED` and not past `needed_by`.
- Not the requester.
- No existing active response from that donor.
- Optional city/area filter.
- If both request hospital coordinates and consented donor coordinates exist, Haversine distance is
  calculated server-side. Exact coordinates are not returned; only an approximate distance.

The UI repeats the limitation: hospital staff must confirm clinical compatibility and donor
eligibility.

---

## 7. Donor responses

```
OFFERED   -> ACCEPTED | DECLINED | WITHDRAWN | CANCELLED
ACCEPTED  -> COMPLETED | WITHDRAWN | CANCELLED
others    -> terminal
```

- A donor can respond only to an eligible verified/partially fulfilled request, with an available,
  consenting, exact-group profile.
- A partial unique index prevents duplicate active responses.
- Requester decisions: accept or decline an `OFFERED` response.
- Donor actions: decline/withdraw own eligible response.
- Requester or hospital can mark `ACCEPTED -> COMPLETED` as an acknowledgement, not medical proof.
- Accepting an offer **never** changes the request to fulfilled.
- Contact details are included in the DTO only when:
  - donor phone: donor consent **and** response `ACCEPTED`/`COMPLETED`;
  - requester phone: request contact consent **and** the viewer is the accepted donor.

---

## 8. Hospital verification

1. Any signed-in user may submit `POST /api/v1/hospital/applications`.
2. The application is `PENDING`, with institutional details and review fields.
3. Administrators list applications and record `APPROVED` or `REJECTED` with a reason.
4. Approval inserts the `HOSPITAL` role and notifies the applicant. Rejection removes verifier
   access if it previously existed.
5. Approved verifiers can access the queue, request review and history endpoints.
6. Every decision is an audit event. Part 1 is explicitly database-backed.

The verify/reject endpoint is modular. Part 2 can require a wallet signature and a confirmed
contract transaction before exposing an “on-chain verified” state.

---

## 9. Notifications and audit

Notifications are rows in `notifications`, recipient-scoped, with an optional related request.
They are created inside the same transaction as the triggering workflow where practical. A failure
to notify must not silently corrupt the workflow; notification writes are part of the service
transaction.

Audit events record:
- actor (nullable for system actions),
- optional request,
- event type,
- non-sensitive metadata,
- timestamp.

Audit rows are not updated or deleted by application flows. Only administrators can read the full
audit log through the API; hospital verifiers receive their own institution's review events.

---

## 10. Frontend structure

| Area | Responsibility |
| --- | --- |
| `context/AuthContext` | session, token, `/me`, sign-in/up/out, refresh |
| `context/ToastContext` | success/error toasts |
| `lib/api` | typed fetch client, bearer token, query serialization, error mapping |
| `lib/queryClient` | TanStack Query defaults and key registry |
| `components/ui` | primitives: buttons, fields, cards, badges, tables, modal, states |
| `components/layout` | public layout, app shell, guards, configuration notice, info pages |
| `pages/public` | public site and auth screens |
| `pages/app` | role-aware workspace pages |
| `tests` | routing, guards, validation, status wording, async states |

Routing:

- Public routes render inside `PublicLayout`.
- `/app/*` renders inside `ProtectedRoute` + `AppShell`.
- Hospital and admin subtrees add `RequireApprovedHospital` / `RequireAdmin`.
- Specification URLs (`/dashboard`, `/requests`, `/hospital/apply`, `/admin/dashboard`, …) are
  redirects to the canonical `/app/*` routes.
- Unknown paths render a public 404.

Data fetching:

- Query keys are centralized in `lib/queryClient.ts`.
- Mutations invalidate the affected workspace queries rather than manually rewriting caches.
- Error states expose a retry action.
- Loading, empty and error states are shared components.

Accessibility baseline: semantic landmarks, skip link, labelled form fields, `role="status"` /
`role="alert"` states, keyboard-friendly dialogs and visible focus behaviour from the design
system.

---

## 11. Transaction and consistency strategy

- Workflow writes use `db.transaction(...)` where multiple rows must be consistent (request +
  history + audit + notification; hospital decision + role grant + audit).
- Transition checks run before writes, inside the service.
- Conflict errors are returned for invalid transitions and duplicates.
- Database constraints (enums, checks, unique indexes, foreign keys) backstop service logic.
- No client-supplied status is accepted for lifecycle changes; endpoints are action-specific.

---

## 12. Part 2 seam

Prepared now:

- `blood_requests.blockchain_audit_key` — opaque random reference.
- `blood_requests.blockchain_sync_status` — `NOT_SCHEDULED`, `AWAITING_WALLET`, `SUBMITTED`,
  `CONFIRMED`, `FAILED`.
- `blockchain_transactions` — network, chain ID, contract, hash, action, status, block number,
  actor, timestamps.
- `documented verification mode` returned by the API (`DATABASE` in Part 1).
- A UI page that states plainly that the chain is not connected and shows no fabricated rows.

Part 2 should implement a blockchain service behind the existing interface and keep on-chain state
separate from database verification.
