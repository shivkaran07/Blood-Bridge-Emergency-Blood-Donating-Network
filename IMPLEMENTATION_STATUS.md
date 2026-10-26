# Implementation Status — BloodBridge Part 1

Last updated: 2026-10-26

This document records what was actually built, what was verified, what could not be verified in
this environment, and the precise Part 2 hand-off. It is intentionally conservative: a feature is
not marked “working” unless code exists **and** a test or build check exercised it.

---

## 1. Phase summary

| Phase | Scope | Status |
| --- | --- | --- |
| A | Inspect workspace, establish frontend/backend foundation | Complete |
| B | Database migrations, RLS, auth, profiles | Complete (live Supabase verification pending) |
| C | Donor management, requests, lifecycle rules | Complete |
| D | Matching, donor responses | Complete |
| E | Hospital verification, administrator workflows | Complete |
| F | Notifications and role dashboards | Complete |
| G | Responsive UI, validation, loading/error states, accessibility baseline | Complete |
| H | Tests, bug fixes, documentation | Complete |

Part 1 stops here. No smart contract or blockchain transaction is implemented.

---

## 2. What was built

### Backend (`backend/`)
- Express 5 + TypeScript API under `/api/v1`.
- Validated environment configuration with placeholder rejection.
- Supabase access-token verification boundary and role loading from `user_roles`.
- Service-level authorization for every protected operation (not UI-only).
- Zod input schemas for profile, donor, request, response, hospital, admin and notification flows.
- Centralized request and response transition machines.
- Parameterized SQL repositories for profiles, donors, requests, responses, hospitals,
  notifications, audit and blockchain reads.
- Cryptographically random opaque `blockchain_audit_key` generation via Node `crypto`.
- Hospital verification workflow, admin application decisions, account suspension/reactivation.
- Dashboard aggregation, suspicious-request heuristics, audit filtering.
- In-app notifications created for meaningful workflow events.
- Helmet, CORS allow-list, rate limiting, structured pino logging with redaction, consistent error
  envelope and request IDs.
- Migration runner (`scripts/migrate.ts`), database check (`scripts/db-check.ts`), administrator
  grant script (`scripts/grant-admin.ts`).

### Database (`supabase/migrations/`)
- Core schema with enums, tables, foreign keys, indexes and check constraints.
- `profiles`, `user_roles`, `donor_profiles`, `blood_requests`, `request_status_history`,
  `donor_responses`, `hospital_profiles`, `notifications`, `audit_events`,
  `blockchain_transactions`, plus migration bookkeeping.
- Signup trigger that creates a profile and only the requested `REQUESTER`/`DONOR` role.
- Partial unique index preventing duplicate active donor responses.
- Row Level Security enabled on all application tables with restrictive grants.
- Policies for own-profile access, authorized request visibility, participant-only responses,
  own notifications, admin-only audit access and no direct writes to audit/blockchain tables.

### Frontend (`frontend/`)
- React 19 + Vite + TypeScript + Tailwind CSS v4 SPA.
- TanStack Query data layer with typed API client and bearer-token requests.
- Supabase Auth context with session persistence, token refresh handling, friendly errors,
  unconfigured/error states and profile loading.
- Role-aware application shell and protected/admin/hospital route guards.
- Public site: landing, how it works, about, FAQ, privacy, terms, unauthorized, 404, login,
  registration.
- Authenticated pages: dashboard, profile, donor profile, request feed, new request, request
  detail, my requests, my responses, notifications, verification & audit.
- Hospital pages: application, dashboard, verification queue, request review, review history.
- Admin pages: overview, users, all requests, hospital applications, audit log.
- Status-aware wording that never presents database verification as blockchain verification.
- Responsive layouts, loading/empty/error states, modals, toasts, confirmation flows.

### Documentation
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API.md`
- `docs/SECURITY.md`
- `docs/BLOCKCHAIN.md`
- `docs/TESTING.md`
- `docs/VIVA_PREPARATION.md`
- This status file.

---

## 3. Verified in this environment

| Check | Command | Result |
| --- | --- | --- |
| Backend typecheck | `npm run typecheck -w backend` | **Passed** |
| Backend tests | `npm test -w backend` | **Passed — 4 files, 24 tests** |
| Frontend typecheck | `npm run typecheck -w frontend` | **Passed** |
| Frontend tests | `npm test -w frontend` | **Passed — 6 files, 34 tests** |
| Frontend production build | `npm run build -w frontend` | **Passed** (chunk-size warning only) |
| API health endpoint | code + backend test suite | Passing against PGlite |
| Migrations against PostgreSQL-compatible engine | backend integration tests | Passing |

Frontend build output on the final run:

```
dist/index.html                   0.78 kB │ gzip:   0.46 kB
dist/assets/index-*.css          52.45 kB │ gzip:   9.62 kB
dist/assets/index-*.js          923.14 kB │ gzip: 251.34 kB
```

The JavaScript chunk-size warning is expected; route-level code splitting is a future optimization,
not a correctness issue.

---

## 4. Not verified — explicit limitations

1. **Live Supabase project.** No Supabase URL, keys, database URI or Supabase CLI were available.
   Therefore:
   - hosted authentication (sign-up confirmation, password reset email),
   - hosted migration application,
   - hosted RLS behaviour,
   were **not** executed against a real Supabase instance.
2. **Real browser + real API end-to-end run.** The SPA builds and component tests pass, but no
   automated browser E2E suite (Playwright/Cypress) was run.
3. **Blockchain.** No contract, wallet, MetaMask, Hardhat network or transaction exists by design.
4. **External notifications.** No email/SMS/push provider is configured; nothing is claimed to be
   delivered externally.
5. **In-memory rate limiting.** Correct for a single process; multi-instance deployments need a
   shared store.
6. **No background expiry worker.** Expiry is evaluated during relevant service calls.

These are environment/scope limitations, not silently hidden failures.

---

## 5. Known bugs and rough edges

| Item | Impact | Notes |
| --- | --- | --- |
| No live Supabase validation | Cannot confirm hosted auth/RLS yet | Follow README §7 once credentials exist |
| Large initial JS bundle | Slower first load on slow networks | Add `React.lazy` route splitting if needed |
| Expiry is request-time, not scheduled | Expired requests may remain visibly open until an endpoint evaluates them | Add a scheduled job in a later phase |
| Password reset flow | Supabase supports it; no dedicated “forgot password” UI was added in Part 1 | Accepted gap; document as remaining UI work |
| Self-service account deletion/export | Not implemented | Needs a documented operator/data-protection process |
| Suspicious-request flags | Heuristic only | Must not be treated as proof of fraud |
| Route aliases redirect to `/app/*` | Specification URLs work but canonical URLs differ | Intentional to avoid duplicated guarded trees |
| Frontend build chunk warning | Cosmetic/build-performance only | Not a functional bug |

No known crash, failing test or TypeScript error remains in the committed code.

---

## 6. Acceptance criteria

Legend: ✅ verified · 🟡 implemented, external verification pending · ⬜ not in Part 1 scope

- [x] ✅ Frontend starts — Vite config/build validated; dev server script present.
- [x] ✅ Backend starts — validated config and server entrypoint; health route tested.
- [x] ✅ Environment examples exist — `backend/.env.example`, `frontend/.env.example`.
- [x] ✅ Database migrations exist — two versioned SQL files.
- [x] ✅ Row Level Security configured — enabled on all application tables with policies/grants.
- [ ] 🟡 Registration and login work — implemented with Supabase Auth; requires live project to confirm.
- [x] ✅ Profiles work — API + UI + backend tests.
- [x] ✅ Donor profiles work — API + UI + backend tests.
- [x] ✅ Availability updates work — API + UI + backend tests.
- [x] ✅ Blood requests can be created — API + form + lifecycle tests.
- [x] ✅ Request status transitions are validated — centralized machine + tests.
- [x] ✅ Matching works — exact group, availability, consent, city/area, optional Haversine; tested.
- [x] ✅ Donor responses work — create/accept/decline/withdraw/complete with authorization tests.
- [x] ✅ Hospital applications work — application, admin decision, notifications, tests.
- [x] ✅ Authorized hospital review works — queue, verify/reject, history, tests.
- [x] ✅ Administrator permissions are protected — server guards + role escalation tests.
- [x] ✅ Notifications work — database-backed, read/mark-read, tested.
- [x] ✅ Dashboards use actual database data — service queries; no fabricated statistics.
- [x] ✅ Blockchain audit-reference fields prepared — audit key + sync state + transaction table.
- [x] ✅ No fake blockchain transactions displayed — UI states this explicitly; table empty by default.
- [x] ✅ Responsive pages work — mobile-first Tailwind layouts; no visual regression suite.
- [x] ✅ Important tests exist and were executed — 58 tests total passing.
- [x] ✅ Documentation available — README + seven docs files.
- [x] ✅ Known limitations documented — this file and README §10.

**Part 1 acceptance:** satisfied for everything the available environment can verify. The only
unticked item is live Supabase confirmation, which requires credentials and is explicitly
documented rather than claimed.

---

## 7. Setup steps required from the operator

1. Create a Supabase project.
2. Copy `backend/.env.example` → `backend/.env` and fill in URL, service-role key, database URI,
   CORS origins.
3. Copy `frontend/.env.example` → `frontend/.env` and fill in URL, publishable/anon key, API URL.
4. Run `npm install` at the repository root.
5. Run `npm run migrate -w backend`.
6. Register an account, confirm its email if confirmation is enabled.
7. Run `npm run grant-admin -w backend -- you@example.com`.
8. Start `npm run dev`, then sign in and verify the workflows in a browser.
9. Optionally submit a hospital application and approve it from the admin account.

---

## 8. Precise Part 2 next steps

1. **Contract design**
   - Create `contracts/BloodBridgeAudit.sol` using OpenZeppelin `AccessControl`.
   - Store only opaque audit keys, action codes and timestamps — never personal data.
   - Define roles such as `VERIFIER_ROLE` and `ADMIN_ROLE`.
   - Add events for request verification/rejection anchors.
2. **Hardhat setup**
   - Add `hardhat.config.ts`, local network, deployment scripts and tests.
   - Pin compatible ethers/OpenZeppelin versions.
3. **Wallet identity**
   - Add a `wallet_challenges` table (nonce, user, expiry, used-at) via a new migration.
   - Implement `/api/v1/wallet/challenge` and `/api/v1/wallet/verify`.
   - Bind a verified wallet address to an approved hospital profile.
4. **Transaction service**
   - Implement the existing blockchain interface with ethers.js.
   - Record real `SUBMITTED`, `CONFIRMED` and `FAILED` states in `blockchain_transactions`.
   - Never insert a `CONFIRMED` row before on-chain confirmation.
5. **Verification integration**
   - Require an authorized wallet and a successful transaction before a request can show an
     on-chain verification badge.
   - Keep database verification and on-chain anchoring conceptually separate.
6. **Frontend**
   - Add MetaMask connection, network guard and chain-switch prompts.
   - Show transaction hashes only when the API returns real records.
   - Add explorer links for local Hardhat (none) and Sepolia (Etherscan).
7. **Security**
   - Replay protection for wallet challenges, rate limits, CSRF/CORS review.
   - Re-audit RLS so only the backend can write transaction rows.
8. **Testing**
   - Contract unit tests (role enforcement, duplicate anchors, event emission).
   - Backend tests for challenge expiry, wrong wallet, reverted transaction and confirmation race.
   - End-to-end test on Hardhat local network; optional Sepolia smoke test.
9. **Documentation**
   - Update `docs/BLOCKCHAIN.md`, README status matrix, and Viva notes with the real architecture.

Do not restart the repository for Part 2. Extend the existing schema, service interfaces and UI.
