# BloodBridge — Project Discovery & Technical Audit

**Audit date:** 2026-11-02

**Scope:** Read-only code, repository, test/build, and browser audit. This report is the only file
created for this audit. No application source, configuration, migration, or Git history was changed.

## Evidence and confidence

- **Verified in code** means the relevant route, service, schema, or migration was inspected.
- **Verified locally** means an automated test/build or the stated browser check passed in this
  worktree; it does not mean a hosted deployment was tested.
- **Not verified** means no suitable authorized account, hosted configuration, or live external
  service was available. No database or blockchain credentials were read.
- Status values in the feature matrix use the requested vocabulary. `WORKING` is limited to the
  code path and local tests cited; it is not a claim of production deployment.

## 1. Executive summary

BloodBridge is an educational full-stack coordination prototype for blood requesters, volunteer
donors, hospital reviewers, and platform administrators. A requester can submit a request, an
approved hospital account can review it, and donors can browse verified exact-blood-group needs and
offer help. The backend records lifecycle history, notifications, and audit events. Optional
blockchain functionality is designed to anchor opaque decision keys; it is separate from the
relational database decision and does not establish clinical correctness or that a donation took
place.

**What is genuinely present and locally verified:** a React application, Express API, versioned
PostgreSQL schema/RLS migrations, service-layer request and response rules, role checks, local
PGlite-based integration tests, and a Solidity contract with local Hardhat tests. Full tests,
typechecks, and production builds passed during this audit.

**What this does not establish:** that the application has been deployed, that a hosted Supabase
project has the latest schema/RLS policies, that production Supabase Auth works with this backend,
or that the browser wallet flow has been exercised against a deployed contract. Protected browser
pages redirected to login, so their rendered experience could not be visually tested.

**Follow-up status:** the donor permission mismatch identified during the audit has since been fixed
and covered by a shared eligibility predicate and regression tests. Production shared rate limiting,
opt-in email delivery, and self-service account anonymization have also been implemented in code;
they require the new migration and deployment-specific Redis/Resend configuration before use.

**Estimated completion:** **68%** (heuristic mean of the ten category scores in §11). This measures
prototype implementation breadth, not production readiness.

## 2. Project overview

### Purpose and boundaries

The application coordinates non-clinical requests, donor offers, hospital review, and recorded
decisions. It explicitly does **not** dispatch emergency services, promise availability, screen
donors medically, or determine clinical compatibility. Public messaging instructs people to contact
local emergency services and hospitals directly.

### Users and roles

- **Requester:** submits and manages their own blood requests and decides how to handle donor
  offers.
- **Donor:** maintains blood group, availability, contact consent, and optional approximate
  location; browses verified requests and manages offers.
- **Hospital verifier:** applies for institutional access. Only an administrator can approve the
  application; approved accounts can review eligible requests.
- **Administrator:** manages users and hospital applications, sees platform request/activity data,
  and inspects audit history.

The authoritative role values are `REQUESTER`, `DONOR`, `HOSPITAL`, and `ADMIN`. Registration
offers only requester and donor account types. Hospital access is approval-gated; administrator
access is provisioned separately.

### Technology

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook
  Form/Zod, Supabase JS Auth, ethers.js.
- **Backend:** Node.js, Express 5, TypeScript, Zod, `pg`, Supabase Auth verification, Pino logging,
  express-rate-limit.
- **Database/authentication:** Supabase Auth and PostgreSQL. SQL migrations define the app schema,
  grants, and RLS. Backend integration tests use PGlite with local Supabase-auth stubs.
- **Blockchain:** Solidity 0.8.28, OpenZeppelin AccessControl, Hardhat 3, ethers.js adapter.
- **External dependency:** browser authentication and account recovery depend on Supabase Auth.
  Blockchain mode additionally depends on an RPC endpoint, deployed contract, wallet, and verifier
  role. No SMS, email, push, maps, or medical eligibility integration was found.

### Runtime topology

```text
React/Vite browser
  ├─ Supabase Auth (sign-up, sign-in, session, password recovery)
  └─ Express REST API (/api/v1, bearer token)
       ├─ verifies token with Supabase Auth
       ├─ reads trusted roles/account state from PostgreSQL
       ├─ services → repositories → PostgreSQL
       └─ optional read-only chain adapter; wallet-signed tx submitted by browser
```

The frontend API base defaults to `http://localhost:4000/api/v1`
(`frontend/src/lib/env.ts:10-15`); the backend defaults to port 4000
(`backend/src/config/env.ts:47-64`). The browser’s Supabase client uses only `VITE_*` public
configuration; server-side configuration includes database and service-role credentials. Actual
environment values were not inspected.

## 3. Repository structure and key modules

| Location | Responsibility |
|---|---|
| `frontend/src/App.tsx` | Public, protected, role-gated, and alias routes. |
| `frontend/src/pages/public/` | Landing, informational/legal, registration, login, and password recovery pages. |
| `frontend/src/pages/app/` | Requester/donor workspace, hospital reviewer, and administrator screens. |
| `frontend/src/components/` | Layout, navigation, request/response cards, tables, dialogs, and UI primitives. |
| `frontend/src/context/` | Supabase authentication and toast/appearance state. |
| `frontend/src/lib/` | API client, environment access, request presentation, validation, and blockchain client helpers. |
| `backend/src/app.ts` | Express middleware and API router composition. |
| `backend/src/routes/index.ts` | API path, method, validation, limiter, and authorization wiring. |
| `backend/src/middleware/` | Token authentication, role guards, input validation, error mapping, and rate limiting. |
| `backend/src/controllers/` | HTTP controller layer. |
| `backend/src/services/` | Workflow, matching, lifecycle, authorization, notifications, audit, and anchoring logic. |
| `backend/src/repositories/` | PostgreSQL queries and data mapping. |
| `backend/src/db/` | PostgreSQL adapter and migration runner. |
| `backend/src/tests/` | Vitest/Supertest tests using PGlite and stub auth/chain dependencies. |
| `contracts/contracts/` | Solidity audit-record contract. |
| `contracts/scripts/`, `contracts/test/` | Deploy/admin/report scripts and Hardhat tests. |
| `supabase/migrations/` | Five SQL migration files defining schema, RLS/grants, wallet/chain additions, and location-consent change. |
| `docs/` | API, architecture, database, security, testing, blockchain, and educational documentation. |

Important backend entry points are `backend/src/server.ts` and `backend/src/app.ts`.
`frontend/src/main.tsx` mounts the SPA. `contracts/contracts/BloodBridge.sol` is the Solidity
contract.

## 4. Feature implementation matrix

| Feature | Expected behaviour | Actual implementation and evidence | Status |
|---|---|---|---|
| Public site | Explain the product without claiming live statistics or clinical service | Landing, How It Works, About, FAQ, Privacy, Terms, login/register, and 404 routes exist. Sample request is labelled illustrative. Public browser viewport scan passed. | **WORKING** |
| Supabase registration/login | Create requester/donor account, persist session, recover password | AuthContext calls Supabase sign-up/sign-in/session/password-reset APIs; registration validates form fields and limits account type to requester/donor. No live Supabase test. | **PARTIAL** |
| Profile settings | Read/update a user’s coordination details | `/me` GET/PATCH, validated backend profile service, profile page completeness and save-state UI. Live API/auth interaction not tested. | **PARTIAL** |
| Donor profile and consent | Require explicit blood group/privacy acceptance; default inactive; separate contact and optional location; preserve existing settings | Form/schema/service/repository support availability, contact consent, privacy acceptance, and nullable coordinates. Migration drops the old coordinate/contact-consent constraint. Tests cover privacy acceptance, independent location consent, existing preferences, and availability. | **WORKING** |
| Donor matching | Match only exact recorded blood group and saved eligible preferences | Candidate SQL requires exact group, active account, availability, and contact consent. Optional coordinates are used server-side for rounded distance; exact coordinates are not returned. Matching tests run. | **WORKING** |
| Verified request feed | Show real open verified requests; honor saved donor group and filters | SQL filters verified/partially fulfilled, unexpired requests; donor’s saved blood group takes precedence; UI handles empty/filter/error states. Feed response permission checks contact consent. | **WORKING** |
| Request-detail response permission | Show “respond” only when backend will accept the donor | Shared `evaluateDonorEligibility()` now applies availability, contact consent, exact group, request status/deadline, ownership, and active-response rules to detail, feed, and writes. Regression tests cover the mismatch. | **FIXED LOCALLY** |
| Request creation and lifecycle | Submit unverified request; reviewer decides; enforce valid transitions and expiry | Zod validation, service transition machine, database history/audit/notifications, duplicate detection, and opportunistic expiration exist. Workflow and lifecycle tests pass. | **WORKING** |
| Donor responses and contact | Enforce eligibility and reveal requester contact only after acceptance and required consent | Service validates profile/availability/contact consent, exact group, request status/deadline, and ownership. DTO filters contact; tests cover duplicate offers and consent-based disclosure. | **WORKING** |
| Hospital onboarding/review | Application is pending until admin approval; approved reviewer can process queue | Application and admin decision flows, approved-hospital guards, queue, review history, and dashboard code exist. Local workflow tests cover application/approval and role-aware dashboards. | **WORKING** |
| Administrator controls | Manage users, hospitals, requests, suspicious signals, audit | Admin routes/service/pages are present and guarded. Integration tests run; no live administrator browser session. Suspicious signals are heuristic review aids, not an automated judgment. | **PARTIAL** |
| In-app notifications | Record and display workflow notices; mark own notice read | Database-backed list/read endpoints and ownership checks. | **WORKING** |
| Database verification and audit | Decisions belong to the app database and are clearly reported as such | Default mode is `DATABASE`; status DTO explains no transaction is created. Audit and status pages render actual database records. Hosted configuration unverified. | **WORKING** |
| Optional wallet binding | Prove key control with expiring, single-use signed challenge; do not grant verifier access | Challenge/message hashes, expiry, signature recovery, one-time consumption, one-wallet/account constraints, and separate on-chain role status; tests cover replay, mismatch, and binding conflict. Live wallet not tested. | **PARTIAL** |
| Optional on-chain anchoring | Only configured mode submits wallet transaction; backend verifies receipt/state before DB update | Contract, browser helpers, backend receipt verification/reconciliation states, and 25 local Solidity tests exist. No deployed-network end-to-end verification in this audit. | **PARTIAL** |
| Email alerts | Notify opted-in users without disclosing request or health details | Resend sender, retrying durable outbox, explicit opt-in/out, and bounded delivery attempts are implemented. Requires Resend credentials and migration; no live provider delivery was tested. | **IMPLEMENTED; EXTERNAL CONFIG REQUIRED** |
| Account closure | Remove direct personal details while preserving non-identifying workflow history | Recent-password-confirmed anonymization cancels active requests, scrubs direct details, removes donor/hospital/wallet/notification data, disables sign-in, and retains scrubbed history. Auth record is retained; external identity-provider erasure is not covered. | **IMPLEMENTED LOCALLY** |
| Shared production rate limits | Enforce limits across API replicas | Redis-backed stores use independent limiter prefixes; production startup requires `REDIS_URL`. No live Redis multi-replica test was run. | **IMPLEMENTED; EXTERNAL CONFIG REQUIRED** |
| Production hosted service | Run against approved Supabase, deployed API, secure monitoring and operational policies | Configuration/deployment code exists, but live Supabase, hosted migration/RLS state, public deployment, and real-user workflows were not verified. | **NOT VERIFIED** |

### Donor response permission fix

The initial audit finding was resolved in `backend/src/services/requestService.ts` by sharing
`evaluateDonorEligibility()` across request details and feed responses. The write path still enforces
the same rules. See `backend/src/tests/can-respond.test.ts` for regression coverage.

## 5. User roles and journeys

### Requester

1. Register through Supabase with requester account type and confirm email if configured.
2. Sign in; the frontend loads `/me`, while the backend verifies the bearer token and reads trusted
   role/account state.
3. Complete profile details and submit a request. Service validates required-by time, paired
   coordinates, duplicate active requests, and request fields.
4. Request begins in `SUBMITTED`; it is not visible in the donor feed as verified.
5. Approved hospital claims/reviews it. Decision history, audit event, and in-app notification are
   written.
6. If verified and still open, donors can see it. Requester can accept/decline offers; requester
   contact is withheld unless the request opted into sharing and a donor offer is accepted.
7. Cancel, complete, or allow the request to expire according to its current status.

**Limitations:** no dispatch, medical screening, clinical compatibility check, actual blood
inventory, SMS/push/email delivery, or guarantee that donors will respond.

### Donor

1. Register as donor or add donor settings later.
2. Explicitly choose a blood group and accept donor privacy information; availability and contact
   sharing are separate settings. Approximate location is optional.
3. Browse verified requests. A saved donor blood group constrains feed results.
4. Offer only when the server sees availability, contact consent, exact blood-group equality,
   unexpired eligible request, and no active duplicate offer.
5. Track response decisions and withdraw/decline/completion where allowed.

Exact donor coordinates are not intended to leave the backend. The older base migration contains
the constraint tying coordinates to contact consent; the later migration removes it. A deployed
database must have that forward migration applied.

### Hospital verifier

1. Register as requester or donor, then submit hospital application.
2. Wait for admin decision; pending/rejected applications do not confer verifier authorization.
3. Once approved, review the queue and record decisions. Backend verifies approved-hospital
   authorization and prevents reviewing the account’s own request.
4. In database mode, decision is a database/audit event. In configured on-chain mode, wallet
   authorization and a backend-verified chain result are additional steps.
5. Inspect hospital review history.

### Administrator

1. An operator provisions the `ADMIN` role using the documented administrative workflow; public
   registration does not offer that role.
2. Review hospital applications, user/account state, requests, heuristic suspicious signals, and
   audit data.
3. Administrative endpoints require server-loaded admin role; frontend role checks are UX guards,
   not the security boundary.

### Logout and account lifecycle

Supabase Auth sign-out clears the local session. Password-reset and password-update flows are
implemented. No self-service account deletion or complete account erasure workflow was identified
in the inspected route surface.

## 6. Frontend and UI/UX audit

### Routes

Public routes in `frontend/src/App.tsx:109-123`:

- `/`, `/how-it-works`, `/about`, `/faq`
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/privacy`, `/terms`, `/unauthorized`, wildcard not-found

Authenticated workspace routes in `App.tsx:127-155`:

- `/app` dashboard, `/app/profile`, `/app/donor`, `/app/requests`,
  `/app/requests/new`, `/app/requests/:id`, `/app/my-requests`,
  `/app/my-responses`, `/app/notifications`, `/app/blockchain`,
  `/app/hospital/application`
- Approved hospital: `/app/hospital`, `/app/hospital/queue`,
  `/app/hospital/requests/:id`, `/app/hospital/audit`
- Admin: `/app/admin`, `/app/admin/users`, `/app/admin/requests`,
  `/app/admin/requests/:id`, `/app/admin/hospitals`, `/app/admin/audit`
- Specification aliases redirect to the canonical `/app/*` routes.

### Screens and interaction evidence

| Screen group | Implementation | Audit finding |
|---|---|---|
| Landing and public information | Brand-consistent dark/crimson styling; explanatory workflow and disclosures | Browser checked. Static sample is visibly marked “Example only” and “Illustrative interface sample — not live platform data.” |
| Registration/login/recovery | React Hook Form/Zod; Supabase Auth integration; field errors and confirmation state | Public form pages rendered in browser; no real signup/sign-in was submitted. |
| Requester dashboard | Role-aware API data, attention panel, metrics, recent requests/activity | Code and backend dashboard tests inspected; authenticated visual testing unavailable. |
| Request feed | Applied/draft filters, reset, real API feed, distinct error and empty states | Code and test suite checked; protected page could not be rendered with an authenticated account. |
| My Requests/Request Detail | Status mapping, status filter, deadlines, lifecycle actions | Code and presentation tests checked; authenticated browser behavior not verified. Detail `canRespond` mismatch noted above. |
| Donor profile | Saved settings, explicit privacy acknowledgement, separated consent controls | Frontend donor-profile tests and backend workflow tests passed; not browser-tested authenticated. |
| Profile settings | Completeness reminder, unsaved/saving/saved/error states, reset confirmation | Source reviewed and full frontend test/build passed; no authenticated browser save/failure interaction. |
| Hospital dashboard/queue/audit | Role-gated review tools and real API route wiring | Source and backend test suite inspected; no authorized browser session. |
| Admin dashboard/users/requests/hospitals/audit | Role-gated data and administrative workflows | Source and backend test suite inspected; no authorized browser session. |
| Verification & Audit | Database/on-chain mode clarity, wallet-vs-role separation, sync operation states | Source and verification-status tests inspected; no authenticated browser session or live chain. |

### Browser checks actually performed

- Vite development server served the current frontend at `http://127.0.0.1:5173`.
- Checked 8 public routes (`/`, `/how-it-works`, `/about`, `/faq`, `/privacy`, `/terms`, `/login`,
  `/register`) at 320, 375, 430, 768, 1280, and 1440 CSS pixels: **48 route/viewport checks**.
- Compared `document.documentElement.scrollWidth` with `clientWidth`: no horizontal overflow in
  those checks.
- Visually inspected the landing page at 375 px. Its mobile navigation was collapsed; the sample
  workflow label and two primary actions were visible.
- Tried protected routes for dashboard, feed, My Requests, profile, donor profile, verification,
  hospital, and admin. Each redirected to `/login?redirect=...`, confirming the unauthenticated
  guard but preventing inspection of the protected page itself.
- No authenticated browser session was available. No assertion is made that protected screens
  passed visual or workflow QA.
- No keyboard-only, screen-reader, 200%-zoom, contrast-automation, dialog focus-trap, or interactive
  mobile-menu test was run.

### Accessibility and responsive caveats

Source uses semantic route/page structure, labels, accessible names for many icon-only controls,
and shared form components. This was not a formal accessibility audit. Public pages showed no
horizontal overflow at the tested widths, but that does not verify clipped content, all dialogs,
tables, or authenticated navigation at small sizes.

## 7. Backend and API audit

### API conventions and controls

- API prefix: `/api/v1`; success payloads use `{ data: ... }`, errors use a consistent error
  envelope with request ID.
- `/health` and `/meta` are intentionally public (`backend/src/routes/index.ts:116-149`).
- `router.use(authenticate)` protects subsequent API routes (`index.ts:150`). Admin routes are
  guarded by `requireAdmin`; hospital operations use `requireApprovedHospital`.
- Authorization session tokens are checked against Supabase Auth `getUser`; role/account state is loaded from
  the database and suspended accounts are blocked (`backend/src/middleware/auth.ts:12-38`).
- Request bodies/queries use Zod validation. SQL repositories use parameterized values.
- Express config includes Helmet, JSON body-size limit, CORS allow-list, structured request IDs,
  and global/write/specialized rate limits.

### Endpoint summary

All routes below are under `/api/v1`. Except `/health` and `/meta`, endpoints require a valid
bearer token. “Admin” and “Approved hospital” refer to additional server-side checks.

| Endpoint | Method | Purpose | Authorization |
|---|---|---|---|
| `/health` | GET | Database/API health probe | Public; reports database reachability |
| `/meta` | GET | Product/API phase and configured verification metadata | Public |
| `/me` | GET, PATCH | Read/update current profile | Authenticated; own profile |
| `/donor/profile` | GET, PUT | Read/create/update donor profile | Authenticated; own profile |
| `/donor/availability` | PATCH | Toggle saved availability | Authenticated; own profile |
| `/requests/feed` | GET | List open verified requests with blood-group/city filters | Authenticated; donor-aware shaping |
| `/requests/mine` | GET | List own requests with status/pagination | Authenticated; own records |
| `/requests` | POST | Create a submitted blood request | Authenticated; create/write/request rate limits |
| `/requests/:id` | GET | Request details and viewer-specific permissions | Authenticated; service-level visibility |
| `/requests/:id/history` | GET | Request status history | Authenticated; owner/admin/approved-hospital policy |
| `/requests/:id/matches` | GET | Matching donor summary | Authenticated; authorized request manager |
| `/requests/:id/blockchain` | GET | Per-request chain/audit state | Authenticated; owner/admin/approved hospital |
| `/requests/:id/responses` | GET | Offers on a request | Authenticated; requester/admin/approved hospital |
| `/requests/:id/respond` | POST | Create donor response | Authenticated; server rechecks donor/request eligibility |
| `/requests/:id/cancel` | POST | Cancel own eligible request | Authenticated; owner policy |
| `/requests/:id/complete` | POST | Record completion/partial fulfilment | Authenticated; owner/service transition rules |
| `/requests/:id/claim` | POST | Claim request for review | Approved hospital |
| `/requests/:id/verify` | POST | Verify request | Approved hospital |
| `/requests/:id/reject` | POST | Reject request with reason | Approved hospital |
| `/requests/:id/chain-complete` | POST | On-chain-mode completion path | Approved hospital |
| `/responses/mine` | GET | List current donor’s responses | Authenticated; own responses |
| `/responses/:id/decision` | POST | Requester accepts/declines offer | Authenticated; request owner |
| `/responses/:id/withdraw` | POST | Donor withdraws own offer | Authenticated; response owner |
| `/responses/:id/decline` | POST | Donor declines own offer | Authenticated; response owner |
| `/responses/:id/complete` | POST | Record response completion | Authenticated; workflow authorization |
| `/hospital/applications` | POST | Submit hospital application | Authenticated; application rate limit |
| `/hospital/application` | GET | Read own hospital application | Authenticated; own application |
| `/hospital/queue` | GET | List review queue | Approved hospital |
| `/hospital/dashboard` | GET | Hospital review metrics | Approved hospital |
| `/hospital/audit` | GET | Hospital review history | Approved hospital |
| `/notifications` | GET | List recipient notices | Authenticated; own notices |
| `/notifications/:id/read` | POST | Mark own notice read | Authenticated; owner check |
| `/dashboard` | GET | Role-aware dashboard payload | Authenticated |
| `/blockchain/status` | GET | Verification mode and chain health/operation status | Authenticated |
| `/blockchain/operations` | GET | List visible anchor operations | Authenticated; service-level visibility |
| `/blockchain/operations/:id/confirm` | POST | Confirm wallet-submitted transaction | Authenticated; actor/admin checks and backend chain validation |
| `/blockchain/operations/:id/reconcile` | POST | Reconcile pending chain outcome | Authenticated; service-level authorization |
| `/wallet/challenge` | POST | Issue expiring wallet-ownership challenge | Authenticated; write rate limit |
| `/wallet/verify` | POST | Verify signature and bind wallet | Authenticated; write rate limit |
| `/wallet/status` | GET | Read own wallet binding and role status | Authenticated; own binding |
| `/wallet/binding` | DELETE | Unbind own wallet | Authenticated; own binding |
| `/admin/overview`, `/admin/stats` | GET | Operational summary and statistics | Admin |
| `/admin/users` | GET | Search/list users | Admin |
| `/admin/users/:id/status` | PATCH | Suspend/reactivate eligible account | Admin |
| `/admin/requests` | GET | Search/filter platform requests | Admin |
| `/admin/requests/:id/cancel` | POST | Cancel request as admin with reason | Admin |
| `/admin/suspicious` | GET | Retrieve heuristic review signals | Admin |
| `/admin/audit` | GET | Inspect platform audit trail | Admin |
| `/admin/hospital-applications` | GET | List hospital applications | Admin |
| `/admin/hospital-applications/:id/decision` | POST | Approve/reject application | Admin |

Route definitions and middleware placement are in `backend/src/routes/index.ts:116-422`.

### Business logic notes

- `requestService.ts` owns creation, duplicate prevention, expiry, status transition, history,
  notification, and viewer-specific DTO shaping.
- `responseService.ts` revalidates donor availability/contact consent and request eligibility at
  write time. It does not trust a frontend `canRespond` flag.
- `donorRepository.ts` filters candidates by exact blood group, availability, contact consent, and
  active account. The donor match service returns a masked name and general location, not exact
  coordinates.
- `dashboardService.ts` combines requester, donor, hospital, admin, and unread-notification data;
  it invokes expiry before computing dashboard metrics.
- `anchorService.ts` only advances database status after the backend validates a wallet transaction
  receipt, sender/recipient, event, and contract state; retry/reconciliation states are persisted.

## 8. Database, migrations, and external services

### Schema

The core schema creates:

- `profiles` and `user_roles`
- `donor_profiles`
- `blood_requests` and `request_status_history`
- `donor_responses`
- `hospital_profiles`
- `notifications`
- `audit_events`
- `blockchain_transactions`

The blockchain additions create `wallet_challenges` and `wallet_bindings` and extend transaction
and sync status enums. Constraints enforce enum values, field lengths, coordinate ranges/pairs,
approval metadata, unique active offers, unique request duplicates, and one wallet per account and
account per wallet.

### Migrations

| Migration | Purpose | File exists | Local test application | Hosted status |
|---|---|---|---|---|
| `20261026090000_core_schema.sql` | Core schema, types, constraints, indexes, triggers | Yes | Applied by PGlite test setup | Not verified |
| `20261026090100_rls_and_grants.sql` | RLS policies and browser grants | Yes | Applied by PGlite test setup | Not verified |
| `20261026090200_blockchain_part2.sql` | Wallet tables, chain states/columns, RLS | Yes | Applied by PGlite test setup | Not verified |
| `20261026090300_wallet_challenge_expiry.sql` | Challenge expiry additions | Yes | Applied by PGlite test setup | Not verified |
| `20261102090000_separate_donor_location_consent.sql` | Drops obsolete coordinate/contact-consent check | Yes | Applied by PGlite test setup | Not verified |

`backend/src/tests/helpers.ts:49-91` creates an ephemeral PGlite DB and runs every migration.
`backend/src/db/migrate.ts` records versions in `public.schema_migrations`. No migration command was
run against an external database. The previous core migration still contains the old coordinate
constraint; a database that has not applied the new migration will continue rejecting location
coordinates when contact consent is false.

### RLS and privacy

The RLS migration enables RLS on core tables, grants narrow browser access, and leaves critical
workflow writes to the backend. Donor profiles are owner/admin-readable through direct Supabase
access; verified request listing is deliberately column-limited; contact phone and exact request
coordinates are omitted from browser table grants. Backend response serializers gate contact
details. Wallet challenge data is intended to remain backend-only; wallet bindings are owner-read.

The backend uses server-side database credentials; RLS is defense in depth, not a substitute for
service-level authorization. Actual production database role/grant state was not queried.

### Integrations

- **Supabase Auth:** implemented in frontend and backend verifier; hosted tenant, email settings,
  token verification, and live password recovery were not tested.
- **PostgreSQL/Supabase:** SQL schema and adapters exist; automated tests use PGlite, not a remote
  Supabase database.
- **Blockchain:** contract compiles/tests locally. Optional mode depends on actual configured
  contract/RPC and separately granted verifier role. No live deployment was checked in this audit.
- **Realtime/file storage/maps:** no production integration was found.
- **Notifications:** database-backed in-app notices only; no provider delivery.

## 9. Security audit

This is a static code-level review, not penetration testing. No real user data, credentials, or
secrets were accessed.

### Positive controls observed

- Supabase `auth.getUser(token)` validates tokens rather than trusting decoded client claims.
- Roles and suspended status are read from the database, not client-editable metadata.
- Hospital and admin routes have server middleware/service authorization.
- Request inputs and filters are schema-validated; repository SQL uses bound parameters.
- Helmet, JSON body size limits, CORS allow-list, request IDs, structured logging, and rate limits
  are configured.
- Pino redacts credential/contact-like fields and request bodies are not intentionally logged.
- RLS and narrow column grants cover direct browser database access.
- Donor exact coordinates are not exposed in match DTOs; contact disclosure is guarded by
  acceptance and consent.
- Wallet ownership uses expiring, consumed-once signed challenges; binding does not itself grant
  verifier authority.
- Contract stores opaque audit keys rather than names, phone numbers, diagnoses, or locations.

### Findings

| Severity | Finding | Evidence and impact | Confidence |
|---|---|---|---|
| MEDIUM | Rate limiting used process-local default storage at audit time | The follow-up adds independent Redis-backed stores and requires `REDIS_URL` in production. No live Redis multi-instance test was possible, so deployed behavior remains unverified. | 9/10 |
| LOW | Chain role lookup failures collapse to “not authorized” | `backend/src/services/walletService.ts:224-246` catches `isVerifier` failures and returns `false`. A temporary RPC outage can be shown as “role not granted” rather than “role status unavailable”; chain health is reported separately. | 8/10 |
| LOW | Detail permission display diverges from write authorization | `requestService.ts:115-145` omits contact consent from `canRespond`; `responseService.ts:28-47` rejects the write. This can cause a donor to see an action that fails, but the inspected server write path still blocks it. | 10/10 |

No CRITICAL or HIGH code-level vulnerability was confirmed in the inspected paths. This is not a
claim that the full attack surface is vulnerability-free; no dynamic security testing, dependency
audit, cloud configuration review, or deployment scan was performed.

### Secret handling

Local `.env` and `.env.local` paths are ignored by Git and were not read. The checked local
environment paths were not listed as tracked files. This does not constitute a full secret scan of
all Git history or deployed systems.

## 10. Tests and quality

### Commands run in this audit

| Command | Result | Exact result and scope |
|---|---|---|
| `npm test` | PASS | Backend: 5 test files, **46 passed**. Frontend: 12 test files, **73 passed**. Total 119. Backend tests use PGlite and stub auth/chain components; frontend tests use Vitest/jsdom/Testing Library. |
| `npm run contracts:test` | PASS | Hardhat/Mocha: **25 passing** local contract tests. No deployed chain tested. |
| `npm run typecheck` | PASS | Backend and frontend `tsc --noEmit`. |
| `npm run contracts:typecheck` | PASS | Contract TypeScript scripts typecheck. |
| `npm run build` | PASS | Backend TypeScript build and frontend production Vite build succeeded. |
| Browser viewport check | PASS, limited | 48 public route/viewport checks; no horizontal overflow. Protected routes redirect because no authenticated session was available. |
| Lint | NOT RUN / not configured | No root, backend, frontend, or contract lint script was present in the inspected package scripts. |
| Hosted integration / live chain | NOT RUN | No hosted Supabase account, production DB migration state, or live blockchain workflow verified. |

Vite emitted a bundle-size warning: the main minified JavaScript chunk is approximately 548 kB,
above the configured/default 500 kB warning threshold (about 162 kB gzip). Build still succeeded.
Frontend tests emitted Node localStorage experimental warnings; no test failed.

The test suites are meaningful for service and UI logic but do not constitute authenticated
browser-based end-to-end tests across roles. There is no configured browser E2E command in the
workspace package scripts.

## 11. Git and recent development history

- Branch: `master`.
- Current HEAD: `511a76e` — “Contract deployment pipeline: deploy/grant/report/abi-sync scripts,
  verified on live hardhat node”.
- Recent commits also include `691647d` (“Contract: real BloodBridge.sol with OZ AccessControl +
  25 passing contract tests”) and `08e2d89` (“Part 1 baseline before blockchain integration”).
- At audit start, `git status --short` showed **138 existing worktree rows**: 107 tracked change
  rows and 31 untracked files. Changes span application source, docs, package files,
  contracts, and Supabase migrations. They were already present and were not altered by this
  audit.
- The significant uncommitted scope includes wallet/anchor integration, new reset-password flows,
  donor consent refinements, dashboard/feed/profile/verification UX, tests, and the forward
  migration. The audit did not attribute those changes to a particular author or commit.
- `README.md` contains stale status figures: it says 43 backend and 45 frontend tests and four
  migrations, while this audit ran 46 backend and 73 frontend tests and found five migration SQL
  files. Update the documentation when the current development work is ready to be integrated.
- `PROJECT_AUDIT_REPORT.md` is the only file created for this audit; no Git operation changed
  history, staging, or existing files.

## 12. Product completeness scores

| Category | Score / 10 | Reason |
|---|---:|---|
| Overall functionality | 7.0 | Main requester/donor/reviewer/admin workflows have code and local integration tests; several production dependencies remain unverified. |
| Frontend implementation | 7.0 | Broad route coverage and form/state handling; authenticated route browser QA and E2E remain absent. |
| UI/UX quality | 7.0 | Consistent visual system and public responsive check; no authenticated visual/accessibility audit. |
| Backend implementation | 8.0 | Layered API, validation, service workflows, role checks, transactions, audit and notifications. |
| Database integration | 6.0 | Schema, migrations, constraints, and RLS exist and run under PGlite; hosted DB state is unknown. |
| Authentication & authorization | 7.0 | Server-side Supabase token/role checks and guards are implemented; live Supabase integration was not tested. |
| Security | 7.0 | Several useful controls; shared-store, hosted database, and live deployment behavior remain unverified. |
| Testing & reliability | 8.0 | 144 tests, typechecks/builds pass; lack of browser E2E and external integration testing limits confidence. |
| Mobile responsiveness | 7.0 | Public routes showed no horizontal overflow at tested widths; protected pages and deeper accessibility remain untested. |
| Production readiness | 4.0 | Hosted Supabase migration, production monitoring, configured shared rate-limit service, and live chain workflow remain unverified. |

**Calculation:** equal-weight mean = 68 / 10 = **68%** (rounded). Scores describe observed
implementation completeness, not a certification or launch recommendation. Production readiness is
lower than code/test completeness because hosted configuration and authenticated operations remain
unverified. This score is the initial audit baseline and has not been recalculated after the
follow-up implementation described above.

## 13. Remaining deployment and validation gaps

1. **Hosted database/auth status is unknown.** Local migrations and PGlite tests cannot prove the
   live RLS/grants/schema are current. The consent, privacy, and email-outbox migrations have not
   been applied to a hosted project.
2. **No authenticated browser acceptance pass.** Protected pages have only redirected to sign-in;
   no authorized requester, donor, hospital, or admin visual/workflow session was available.
3. **Shared Redis and Resend services are unconfigured/unverified here.** Production requires Redis;
   email also requires a sender and Resend key. No live service was contacted.
4. **Blockchain wallet-to-RPC flow remains unverified.** Contract tests do not establish deployed
   network operation.
5. **Operational readiness still needs monitoring, accessibility review, and jurisdiction-specific
   privacy/retention policy.** BloodBridge remains coordination software, not an emergency service.

## 14. Prioritized development roadmap

### P0 — Release blockers / core correctness

| Task | Why | Likely modules | Dependencies | Verification |
|---|---|---|---|---|
| Apply and verify migrations in an approved test Supabase project | PGlite cannot prove deployed schema, grants, or RLS | `supabase/migrations/`, `backend/scripts/migrate.ts`, deployment runbook | Authorized Supabase test project and approval | Record migration table state, verify RLS/grants with test roles, exercise opt-in/out without changing production data. |
| Establish authenticated role test accounts and browser E2E | Protected page rendering and user journeys are currently unverified | Auth setup, frontend tests, browser test tooling | Test Supabase or dedicated auth fixture | Browser runs for requester, donor, approved hospital, and admin at mobile/desktop; capture workflow and overflow results. |
| Configure and validate shared Redis before scaling API replicas | Production code now requires a shared store, but the service is not configured in this environment | `backend/src/server.ts`, deployment config | Authorized Redis service | Multi-instance test confirms shared per-user/IP limits and expected reset behavior. |

### P1 — Essential product completion

| Task | Why | Likely modules | Dependencies | Verification |
|---|---|---|---|---|
| Exercise live Supabase registration, recovery, token validation, and role authorization | All production identity currently rests on an unverified external integration | `AuthContext.tsx`, backend auth verifier, Supabase triggers/migrations | Test project, email provider settings | Full registration → confirmation → login → API → recovery test; confirm unauthorized role access is rejected. |
| Run live local/test-network wallet anchor flow | Contract tests do not cover the integrated wallet/API/RPC setup | `contracts/scripts/`, `anchorService.ts`, browser `submitAnchor.ts`, env setup | Deployed test contract, test wallet/RPC | Verify sign, submit, receipt, backend state, failure, and reconciliation without real funds. |
| Configure and sandbox-test opt-in email delivery | Resend outbox and generic email sender are implemented but need deployment credentials/domain verification | `backend/src/services/emailOutboxService.ts`, deployment config | Authorized Resend project and verified sender | Provider sandbox delivery, retries, opt-out, and no-PII policy checks. |

### P2 — Reliability and user experience

| Task | Why | Likely modules | Dependencies | Verification |
|---|---|---|---|---|
| Split the frontend chunk above 500 kB | Build warns at 548 kB main chunk and may affect initial load | `frontend/src/App.tsx`, Vite build config | Bundle analysis | Production build stays below an agreed threshold; verify route lazy-loading and UX. |
| Improve chain-role lookup error semantics | RPC failure currently maps to `false` rather than an unknown/unavailable result | `walletService.ts`, wallet status DTO/UI | DTO/UI status design | Simulated RPC failure displays unavailable, not “role not granted”; preserve true false result. |
| Complete authenticated responsive and accessibility audit | Current browser measurements only cover public routes and overflow | App shell, mobile nav, forms, dialogs, tables | Authorized test session | Keyboard/focus, screen reader labels, contrast, zoom, touch targets, table overflow, modal dismissal. |

### P3 — Advanced / only if product scope requires

- Add operational dashboards/alerts for API/database health, queue age, failed notifications, and
  anchor reconciliation.
- Add historical reporting only with explicit privacy, retention, and clinical/legal review.
- Add a real medical eligibility or compatibility workflow only with clinical governance; do not
  infer it from exact ABO group matching.
- Consider verified hospital identity integrations only after defining the responsible authority,
  audit process, and revocation policy.

## 15. Known blockers and unverified areas

- No authenticated browser session or test login was available.
- No hosted Supabase Auth, database, RLS, or migration state was checked.
- No external production service credentials/configuration were inspected.
- The newest migration file exists and is exercised in ephemeral PGlite tests; remote application
  status is unknown.
- No live blockchain deployment/wallet transaction was run for this audit.
- No formal accessibility audit, browser E2E suite, lint run, dependency vulnerability scan, or
  cloud security review was performed.
- SMS/push remain unimplemented; email delivery is implemented but requires provider configuration
  and live verification. The product is explicitly not an emergency dispatch or clinical decision
  service.
