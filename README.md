# BloodBridge

**A Blockchain-Based Emergency Blood Donation and Verification Network — Part 1**

BloodBridge is a working full-stack prototype that connects people requesting blood, volunteer
donors, hospital verifiers and platform administrators. It provides registration and sign-in,
donor profiles, emergency requests with a validated lifecycle, exact-group matching, donor
responses, database-backed hospital verification, administrator controls, in-app notifications,
audit history and role-specific dashboards.

> **Part 1 boundary.** Verification in this phase is **database-backed only**. No Solidity
> contract is deployed, no wallet is connected and no blockchain transaction is created. The
> schema, API and UI are prepared for an honest Part 2 integration. The application never labels
> database verification as blockchain verification.

> **Not an emergency service.** BloodBridge does not dispatch help, guarantee blood availability,
> assess donor eligibility or determine clinical compatibility. For immediate danger, call your
> local emergency number and contact the hospital directly.

---

## 1. Current status

| Area | Status |
| --- | --- |
| Backend API (`/api/v1`) | Implemented, typechecked, 24 integration/unit tests passing |
| Frontend SPA | Implemented, typechecked, production build succeeds, 34 tests passing |
| Database schema + RLS migrations | Implemented as version-controlled SQL |
| Supabase Auth integration | Implemented in code; **not run against a live Supabase project** because no credentials were available |
| Hosted Supabase migrations/RLS | **Not verified in this environment**; PGlite is used for automated tests |
| Blockchain contract / wallet | **Not implemented — Part 2** |
| Email / SMS / push delivery | **Not implemented**; in-app notifications only |

See [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) for the detailed acceptance-criteria
checklist and known limitations, and [`docs/TESTING.md`](./docs/TESTING.md) for actual test results.

---

## 2. Features

### Public
- Landing page with honest Part 1 messaging, request/donor calls to action, workflow explanation,
  trust and privacy sections, and FAQ.
- `/how-it-works`, `/about`, `/faq`, `/privacy`, `/terms`, `/unauthorized`, 404.
- Registration, sign-in and session persistence through Supabase Auth.
- Configuration screen instead of a crash when Supabase environment values are missing.

### Requester
- Create a blood request with Zod-validated fields and a non-sensitive public message.
- Requests start as `SUBMITTED`; they never self-verify.
- Track request status history, cancel an eligible request and record completion.
- Review donor offers, accept or decline them, and view contact details only under consent rules.

### Donor
- Create/update a donor profile with blood group, city, general area, availability and contact
  consent.
- Browse verified requests matching the **exact recorded blood group**.
- Offer, withdraw an eligible offer, view response history and update availability at any time.
- Phone numbers and exact coordinates are never returned in public listings.

### Hospital / verifier
- Apply with institutional details; only an administrator can approve the application.
- Approved verifiers receive a pending queue, request review page, decision reasons and review
  history.
- Verification is explicitly database-backed in Part 1.

### Administrator
- Aggregate operational statistics from the live database.
- Review hospital applications (approve/reject with reason).
- Search all requests, inspect heuristic suspicious patterns and cancel a request with a reason.
- Suspend/reactivate non-administrator accounts (with a reason for suspension).
- Inspect the application audit log.

### Cross-cutting
- Centralized request and response transition rules.
- Duplicate-request detection, duplicate active-response prevention.
- Rate limiting, Helmet, CORS allow-list, parameterized SQL, structured logging with redaction.
- Row Level Security on all application tables.
- In-app notifications and audit events for meaningful actions.
- Blockchain audit keys and synchronization states initialized honestly to `NOT_SCHEDULED`.

---

## 3. Architecture

```
React + Vite + TypeScript SPA
        |
        |  Supabase Auth session (JWT)
        v
Express + TypeScript REST API  (/api/v1)
        |
        +-- verify Supabase access token
        +-- role and ownership authorization
        +-- Zod request validation
        +-- rate limiting + Helmet + CORS
        +-- services / repositories
        |
        +--> Supabase PostgreSQL (pg connection, RLS as defence in depth)
        +--> audit + notification service
        +--> blockchain integration interface (Part 2 scaffold only)
```

- The browser uses the Supabase **publishable/anon** key only for authentication.
- The backend verifies the access token with Supabase and then applies its own authorization.
- The backend uses a server-side database connection and a service-role key that never reaches the
  browser. RLS still restricts direct browser table access.
- Request, response, verification, audit and blockchain writes are backend-only.

More detail: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## 4. Repository layout

```
backend/
  scripts/            migrate, grant-admin, db-check
  src/
    config/           validated environment
    controllers/      HTTP request/response handling
    db/               pg adapter, migrations
    http/             async error wrapper
    lib/              crypto, errors, logging, serialization
    middleware/       auth, validation, rate limits, errors
    repositories/     parameterized SQL
    routes/           /api/v1 surface and role guards
    schemas/          Zod input validation
    services/         business rules and workflows
    tests/            Vitest + Supertest + PGlite
    types/            domain types
frontend/
  src/
    components/       UI primitives, layouts, cards, audit table
    context/          auth and toast providers
    lib/              API client, env, formatting, constants
    pages/            public, authenticated, hospital, admin
    tests/            Vitest + Testing Library
    types/            API DTO types
supabase/migrations/  version-controlled SQL schema and RLS
docs/                 architecture, database, API, security, blockchain, testing, viva
```

---

## 5. Prerequisites

- Node.js **20.19+** (developed on Node 26.10.0)
- npm **10+** (developed on npm 11.19.1)
- A Supabase project (free tier is sufficient)
- Optional: Supabase CLI if you prefer `supabase db push`
- No Docker or local PostgreSQL is required for the automated tests (PGlite is used)

---

## 6. Installation

From the repository root:

```bash
npm install
```

This installs both npm workspaces (`backend`, `frontend`).

---

## 7. Supabase setup

### 7.1 Create the project

1. Create a project at <https://supabase.com>.
2. Open **Project Settings → API** and copy:
   - Project URL
   - Publishable key (or the legacy `anon` key)
   - **Service-role key** — server only, never put it in a `VITE_` variable
3. Open **Project Settings → Database → Connection string** and copy a PostgreSQL URI. For
   migrations, the session pooler or direct connection is preferable.
4. Open **Authentication → Providers → Email** and decide whether email confirmation is required.
   - For quick local testing you may disable confirmation.
   - For a realistic flow keep confirmation enabled. The frontend shows a “check your inbox”
     state and registration metadata supplies `full_name` and `account_type`.

### 7.2 Apply the migrations

The SQL files live in `supabase/migrations/`. Either use the project runner or the Supabase CLI.

**Option A — project runner (recommended for this repo):**

```bash
# after creating backend/.env with DATABASE_URL
npm run migrate -w backend
```

The runner:
- creates `public.schema_migrations`,
- applies each `.sql` file in filename order,
- runs each file inside a transaction,
- skips already-applied versions.

**Option B — Supabase CLI:**

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Do not mix the two bookkeeping mechanisms on the same database without reconciling
`public.schema_migrations`.

The migrations create:
- application enums and tables,
- indexes and constraints (including duplicate active-response prevention),
- the `auth.users` signup trigger that creates a profile and the requested `REQUESTER`/`DONOR`
  role,
- Row Level Security policies and restrictive grants.

### 7.3 Environment variables

Copy the examples and fill in real values. **Never commit `.env` files.**

```bash
copy backend\.env.example backend\.env        # Windows
copy frontend\.env.example frontend\.env      # Windows

cp backend/.env.example backend/.env          # macOS/Linux
cp frontend/.env.example frontend/.env        # macOS/Linux
```

Backend variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default 4000) |
| `NODE_ENV` | `development`, `test` or `production` |
| `TRUST_PROXY` | Set `true` only behind a trusted reverse proxy |
| `CORS_ORIGINS` | Comma-separated browser origins |
| `DATABASE_URL` | PostgreSQL connection URI |
| `DATABASE_SSL` | `true` for hosted Supabase |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key; bypasses RLS |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `WRITE_RATE_LIMIT_MAX` | Rate limits |
| `LOG_LEVEL` | pino log level |
| `BLOCKCHAIN_*` | Part 2 placeholders; no contract exists |

Frontend variables (all public):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable/anon key |
| `VITE_API_BASE_URL` | Backend base URL, default `http://localhost:4000/api/v1` |

The backend validates required variables at startup and refuses placeholder values.

### 7.4 Provision the first administrator

Administrator access is **never** available through registration. After creating a normal account
through the UI (and confirming its email), grant the role with the documented script:

```bash
npm run grant-admin -w backend -- admin@example.com
```

The script:
- looks up the Supabase Auth user by email,
- ensures a profile row exists,
- inserts the `ADMIN` role,
- writes a `ROLE_GRANTED` audit event with `source: break-glass-script`.

Sign out and sign in again afterwards so the API reloads role context. There is no hardcoded
production password.

Hospital access is separate: register normally, submit `/app/hospital/application`, then approve it
from an administrator account.

---

## 8. Running the application

Start both workspaces:

```bash
npm run dev
```

Or separately:

```bash
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173
```

Confirm the API is healthy:

```bash
curl http://localhost:4000/api/v1/health
```

Expected shape:

```json
{ "data": { "status": "ok", "database": "reachable", "phase": "PART_1" } }
```

### Canonical and specification routes

The workspace is canonically served under `/app/*` (for example `/app/requests`). The URLs listed
in the project specification (`/dashboard`, `/requests`, `/hospital/apply`, `/admin/dashboard`, …)
are implemented as explicit redirects to the canonical workspace so both forms resolve correctly.
This avoids duplicating guarded route trees.

---

## 9. Tests and quality checks

```bash
npm run typecheck     # backend + frontend TypeScript
npm test              # backend + frontend
npm run build         # backend compile + frontend production build
```

Individual suites:

```bash
npm run test -w backend
npm run test -w frontend
```

Backend tests use:
- Vitest + Supertest against the real Express app,
- PGlite (a PostgreSQL-compatible engine) with the actual migrations,
- a stubbed Supabase token-verification boundary,
- synthetic users and request data only.

Frontend tests use Vitest + jsdom + Testing Library.

Actual results and coverage scope: [`docs/TESTING.md`](./docs/TESTING.md).

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run migrate -w backend` | Apply SQL migrations |
| `npm run db:check -w backend` | Check database connectivity and migration state |
| `npm run grant-admin -w backend -- email` | Grant the first administrator |
| `npm run typecheck` | Typecheck both workspaces |
| `npm test` | Run both test suites |
| `npm run build` | Build backend and frontend |

---

## 10. Known limitations

1. **No live Supabase validation in this environment.** There were no Supabase credentials or
   Docker/Supabase CLI available. Authentication, hosted migrations and hosted RLS are implemented
   but must be verified once credentials are supplied.
2. **Part 1 verification is database-backed.** There is no smart contract, wallet challenge,
   MetaMask connection or on-chain transaction.
3. **No email/SMS/push provider.** Notifications are stored in the database and shown in-app only.
4. **No self-service account deletion or data export.** A real deployment needs a documented
   data-subject request process.
5. **Matching is exact-group only.** It is not a clinical compatibility engine and does not rank by
   medical urgency.
6. **Suspicious-request detection is heuristic.** It flags volume/rejection patterns for operator
   awareness; it is not a fraud determination.
7. **No background job scheduler.** Expiry is evaluated when relevant endpoints run rather than by
   a cron worker.
8. **Frontend bundle is large** (~923 kB before gzip) because the workspace is not yet route-split.
9. **Rate limits are in-memory.** For multi-instance deployment use a shared store.

---

## 11. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| “Connect the frontend to Supabase” screen | Missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; restart Vite after editing `.env` |
| API exits at startup with “Invalid environment configuration” | A required backend variable is missing or still a placeholder |
| `ECONNREFUSED` / network error in the workspace | Backend not running, or `VITE_API_BASE_URL` points to the wrong port |
| Sign-in says email not confirmed | Confirm the email or disable confirmation in Supabase Auth settings |
| Every request returns 401 | Expired session or wrong Supabase project/key pairing; sign out and in again |
| Migration fails on `auth.users` trigger permissions | Run the migration with a role that can access the `auth` schema (direct DB owner/service role) |
| RLS denies a legitimate operation | The browser should not write business tables directly; use the API. Verify the backend's server credentials |
| `db:check` cannot connect | Check `DATABASE_URL`, `DATABASE_SSL`, password encoding and pooler host |

---

## 12. Part 2 hand-off

Part 2 will add, without restarting the repository:
- a Solidity contract using OpenZeppelin access control,
- Hardhat local network and optional Sepolia deployment,
- wallet challenge and MetaMask integration for approved verifiers,
- real transaction submission/confirmation tracking in `blockchain_transactions`,
- an explicit on-chain verification state that is separate from clinical checks.

See [`docs/BLOCKCHAIN.md`](./docs/BLOCKCHAIN.md).
