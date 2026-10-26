# Testing

This document records what was actually executed, what passed, and what remains unverified. Results
below are from the final run on **2026-10-26** in the development environment (Windows, Node
26.10.0, npm 11.19.1).

---

## 1. Summary

| Suite | Command | Files | Tests | Result |
| --- | --- | --- | --- | --- |
| Backend typecheck | `npm run typecheck -w backend` | — | — | **Passed** |
| Backend tests | `npm test -w backend` | 4 | 24 | **Passed** |
| Frontend typecheck | `npm run typecheck -w frontend` | — | — | **Passed** |
| Frontend tests | `npm test -w frontend` | 6 | 34 | **Passed** |
| Frontend production build | `npm run build -w frontend` | — | — | **Passed** (chunk-size warning) |
| Root aggregate | `npm run typecheck && npm test && npm run build` | — | 58 | **Passed** |

Total automated tests: **58** (24 backend + 34 frontend).

---

## 2. Backend tests

Runner: **Vitest** with **Supertest** against the real Express app.
Database: **PGlite** (`@electric-sql/pglite`), a PostgreSQL-compatible engine, with the actual
migration files applied. Auth: the Supabase token-verification boundary is stubbed so tests can
issue synthetic identities.

```bash
npm run test -w backend
```

Observed output:

```
 Test Files  4 passed (4)
      Tests  24 passed (24)
   Duration  6.86s
```

### 2.1 `foundation.test.ts` (3 tests)

- Health endpoint returns `status: ok` and truthful `PART_1` metadata.
- Protected endpoints reject unauthenticated requests.
- Unknown authenticated paths return a consistent 404 envelope.

### 2.2 `workflow.test.ts` (9 tests)

- A new request is created as `SUBMITTED` and does not appear in the donor feed.
- A hospital can apply, but only an administrator can approve the application.
- An approved hospital can verify; a requester or donor cannot.
- Verified requests reach matching donors without leaking contact details.
- Duplicate active responses are rejected; contact is revealed only after acceptance.
- Completion is recorded without claiming medical proof.
- Blockchain status and the per-request audit reference are truthful (`operational: false`,
  `mode: DATABASE`, empty transaction list).
- Notifications are delivered and can be marked read by the recipient only.
- Dashboard sections are role-aware.

### 2.3 `lifecycle.test.ts` (5 tests)

- Exact-group matching with availability, consent and masked identity.
- Withdrawal followed by a new offer; stale decisions are rejected.
- A verified request expires after `needed_by` and closes offers.
- Cancellation blocks later verification.
- Rejection reason validation and rejection recording.

### 2.4 `security.test.ts` (7 tests)

- A submitted request is not exposed to an unrelated authenticated user.
- Unapproved hospital accounts are blocked from verifier workflows.
- Role escalation through registration metadata is refused.
- Admin endpoints are protected; an administrator cannot suspend another administrator.
- Suspension immediately invalidates the account's access.
- RLS denies browser-style sessions the writes they must not perform.
- The donor feed does not reveal requester contact details.

---

## 3. Frontend tests

Runner: **Vitest** + **jsdom** + **Testing Library**.

```bash
npm run test -w frontend
```

Observed output:

```
 Test Files  6 passed (6)
      Tests  34 passed (34)
   Duration  2.62s
```

### 3.1 `routing.test.tsx` (6 tests)

- Landing page renders the hero and both CTA links (`/register?type=REQUESTER`,
  `/register?type=DONOR`), plus the "illustrative sample" disclaimer.
- `/how-it-works` renders.
- `/faq` renders without any "blockchain verified" claim.
- `/privacy` and `/terms` render.
- Unknown public path renders the 404 page.
- The `/dashboard` specification alias resolves to the guarded workspace, which shows the
  configuration notice when Supabase is unconfigured.

### 3.2 `protected-route.test.tsx` (4 tests)

- Unauthenticated visitors are redirected to login.
- Authenticated accounts render the workspace.
- `unconfigured` shows setup instructions instead of a blank screen.
- API failure shows a recoverable error with a retry action.

### 3.3 `register-validation.test.tsx` (3 tests)

- Empty submission produces field-level messages.
- `?type=DONOR` preselects the donor radio.
- Administrator and hospital roles are not offered at registration.

### 3.4 `request-card.test.tsx` (5 tests)

- `SUBMITTED` shows "Awaiting hospital review".
- `VERIFIED` shows "Database verified — not on-chain".
- `REJECTED` shows "Verification rejected" and not a verified label.
- The private requester phone is never rendered.
- Blood group and hospital location render correctly.

### 3.5 `status-badge.test.tsx` (13 tests)

- Every request status renders its expected label.
- Verification wording never promotes an unreviewed request.
- Database verification is labelled and explicitly denied an on-chain anchor.
- A rejected request is not labelled database-verified.
- Prepared synchronization states render honestly.
- The status enum matches the documented set.

### 3.6 `states.test.tsx` (3 tests)

- Loading state announces itself (`role="status"`).
- Error state renders `role="alert"`.
- Empty state shows guidance.

---

## 4. Frontend build

```bash
npm run build -w frontend
```

Observed output:

```
dist/index.html                   0.78 kB │ gzip:   0.46 kB
dist/assets/index-*.css          52.45 kB │ gzip:   9.62 kB
dist/assets/index-*.js          923.14 kB │ gzip: 251.34 kB
✓ built in 471ms
```

There is a **chunk-size warning** because the JavaScript bundle exceeds 500 kB. This is a
performance optimization opportunity (route-level code splitting), not a build failure. The build
command runs `tsc --noEmit` first, so a type error would fail it.

Backend build (`npm run build -w backend`) compiles TypeScript to `dist/` with `tsc`.

---

## 5. Test environment design

### 5.1 Why PGlite

A hosted Supabase project, Docker and the Supabase CLI were not available. PGlite provides a real
PostgreSQL-compatible engine in-process, so the tests exercise the **actual migration SQL**,
constraints, partial unique indexes and policies rather than a hand-written mock schema. This is
meaningfully stronger than mocking the database, but it is **not** identical to a hosted Supabase
instance.

Known PGlite differences observed during development:

- Some array parameter binding behaved differently; one query uses an explicit array literal
  instead of a JS array binding.
- Supabase-specific `auth` internals are simulated rather than executed by GoTrue.
- PostgREST/role simulation for RLS tests is approximated with `SET ROLE`-style sessions.

### 5.2 Why auth is stubbed

Tests need many distinct identities (requester, donor, approved hospital, unapproved hospital,
admin, suspended user). Stubbing `auth.getUser` lets each test assume a synthetic token without
creating real Supabase users. The real token verification path is code-reviewed but **not executed
against a live project** here.

### 5.3 Test data

All data is synthetic: `@example.test` emails, `+910000000000`-style numbers, invented hospital
names. No real patient or donor data is used anywhere.

---

## 6. What is NOT tested

Be explicit about this in any report or viva:

| Gap | Why | Consequence |
| --- | --- | --- |
| Live Supabase Auth (sign-up confirmation, password reset) | No credentials/project | Cannot claim hosted auth verified |
| Hosted migration application | No Supabase CLI/DB | Migrations verified only on PGlite |
| Hosted RLS behaviour | No hosted DB | Policies tested on PGlite, not production |
| Browser end-to-end flows | No Playwright/Cypress suite | UI and API are tested separately, not together in a browser |
| Blockchain contract/wallet | Out of Part 1 scope | Nothing to test yet |
| Email/SMS/push delivery | No provider configured | In-app notifications only |
| Load, DoS, penetration testing | Out of scope | Not production-hardened |
| Visual regression / cross-browser | No screenshot suite | Responsive layout code-reviewed, not pixel-tested |
| Accessibility audit tooling | No axe run | Semantic baseline only |

---

## 7. How to run everything

From the repository root:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Individually:

```bash
npm run typecheck -w backend
npm run typecheck -w frontend
npm test -w backend
npm test -w frontend
npm run build -w backend
npm run build -w frontend
```

Watch modes:

```bash
npm run test:watch -w backend
npm run test:watch -w frontend
```

---

## 8. Reproducing results

1. `npm install`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

Expected: all commands exit 0. Frontend tests print a harmless Node `ExperimentalWarning` about
`localStorage` under jsdom; it does not affect results.

If backend tests fail on migration application, confirm Node is 20.19+ and that
`node_modules/@electric-sql/pglite` installed correctly. No external database is required.
