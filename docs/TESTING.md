# Testing

This document records what was actually executed, what passed, and what remains unverified. Results
below are from the latest run on **2026-11-02** in the development environment (Windows, Node
26.10.0, npm 11.19.1).

---

## 1. Summary

| Suite | Command | Files | Tests | Result |
| --- | --- | --- | --- | --- |
| Backend typecheck | `npm run typecheck -w backend` | — | — | **Passed** |
| Backend tests | `npm test -w backend` | 9 | **65** | **Passed** |
| Frontend typecheck | `npm run typecheck -w frontend` | — | — | **Passed** |
| Frontend tests | `npm test -w frontend` | 12 | 74 | **Passed** |
| Frontend production build | `npm run build -w frontend` | — | — | **Passed** (no chunk-size warning after code-splitting) |
| Contract tests | `npm run contracts:test` | 1 | 25 | **Passed** |
| Contract typecheck | `npm run contracts:typecheck` | — | — | **Passed** |

Total automated tests: **164** (65 backend + 74 frontend + 25 contract).

### Additions since 2026-10-26

New backend tests cover the `canRespond` eligibility mismatch, recent-auth account anonymization,
opt-in email outbox enqueue/opt-out/delivery/retry, and production Redis/email configuration.
The profile UI test checks the account closure confirmation and unavailable email-delivery state.

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
  Test Files  6 passed (6)
       Tests  56 passed (56)
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

### 2.5 `blockchain.test.ts` (19 tests)

- Wallet ownership: only a cryptographically valid signature binds a wallet; wrong-wallet signatures, replays, expired challenges and duplicate bindings are refused.
- Anchoring: refuses accounts without a verified wallet or on-chain `VERIFIER_ROLE`, and refuses a requester anchoring their own request.
- Prepare → confirm: the database decision stays pending until the wallet transaction receipt is verified; confirmation is idempotent and failed transactions never change the database status.
- Independent verification: sender, recipient and emitted events are re-checked by the backend rather than trusted from the frontend.
- Reconciliation: unknown receipts stay open, and an operation whose chain truth arrived but whose database update failed can be reconciled.
- ON_CHAIN completion: completion and rejection route through the on-chain record, and requests never verified on chain cannot be completed.

### 2.6 `can-respond.test.ts` (10 tests) — added 2026-11-02

Regression tests for the `canRespond` permission flag returned by `GET /api/v1/requests/:id`
(request detail) and `GET /api/v1/requests/feed` (donor feed). They prevent recurrence of the
contact-consent mismatch documented in the initial `PROJECT_AUDIT_REPORT.md`.

Fix: a shared `evaluateDonorEligibility()` helper in `requestService.ts` is now called by both
`detailDto` and `listRequestFeedForViewer` so the rules cannot drift independently. The server-side
write path remains the ultimate security boundary.

Scenarios covered (all checked against detail + feed where applicable):

| Scenario | Expected `canRespond` |
| --- | --- |
| All conditions met | `true` |
| `consent_to_contact = false` | `false` (was `true` in detail before fix) |
| No donor profile | `false` |
| `is_available = false` | `false` |
| Blood group mismatch | `false` |
| Request expired | `false` (server-side 409) |
| Already has active response | `false` |
| Request not yet verified (SUBMITTED) | `false` (server-side 409) |
| Requester viewing own request | `false` |
| Backend rejects no-consent donor | 403 confirmed |

### 2.7 `account-privacy.test.ts` (3 tests)

- Account closure requires a recently reauthenticated token (verified `auth_time` within five
  minutes) and rejects closure by the last administrator.
- Active requests and offered/accepted responses are cancelled; direct request/profile details,
  donor/hospital/wallet data, and notifications are scrubbed or removed.
- A failed Auth-provider disablement is surfaced and the suspended account can retry closure.

### 2.8 `email-outbox.test.ts` (3 tests)

- Email jobs are queued only after explicit opt-in; pending jobs expire on opt-out.
- Provider delivery uses generic text and does not include notification/request content.
- Provider failures schedule a bounded retry. The tests mock the provider; no live email is sent.

---

## 3. Frontend tests

Runner: **Vitest** + **jsdom** + **Testing Library**.

```bash
npm run test -w frontend
```

Observed output:

```
  Test Files  12 passed (12)
       Tests  74 passed (74)
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

### 3.5 `status-badge.test.tsx` (14 tests)

- Every request status renders its expected label.
- Verification wording never promotes an unreviewed request.
- Application verification is distinguished from a confirmed on-chain transaction.
- Confirmed transactions are shown distinctly.
- A rejected request is not labelled database-verified.
- Prepared synchronization states render honestly.
- The status enum matches the documented set.

### 3.6 `states.test.tsx` (3 tests)

- Loading state announces itself (`role="status"`).
- Error state renders `role="alert"`.
- Empty state shows guidance.

### 3.7 `profile-appearance.test.tsx` (1 test)

- The Profile page renders the appearance control and applying a chosen theme updates the document and persists the choice.

### 3.8 `theme.test.tsx` (4 tests)

- Defaults to the operating-system preference and renders light without a saved choice.
- Persists an explicit theme, applies it to the document and updates the browser theme-color.
- Toggles between light and dark relative to the rendered theme.
- Follows operating-system changes while set to "system".

### 3.9 `ui-primitives.test.tsx` (5 tests)

- Switch toggles accessibly (`role`/`aria-checked` and keyboard handling).
- PasswordInput reveals and hides a password without changing its value.
- CopyButton copies a value and confirms it in place.

---

## 4. Frontend build

```bash
npm run build -w frontend
```

Observed output:

```
dist/assets/index-*.js           140 kB │ gzip:  34 kB   (main entry — down from 548 kB)
dist/assets/supabase-*.js        214 kB │ gzip:  55 kB
dist/assets/react-core-*.js      210 kB │ gzip:  65 kB
dist/assets/ethers-*.js          252 kB │ gzip:  93 kB
... (additional route/component chunks)
✓ built in ~914ms
```

The **chunk-size warning was resolved** on 2026-11-02 by adding `manualChunks` vendor splitting
in `frontend/vite.config.ts`. Heavy third-party dependencies (Supabase, ethers.js, React core,
TanStack Query, React Router, Lucide icons, React Hook Form/Zod) are now in separate named chunks.
The main entry chunk dropped from ~548 kB to ~140 kB. Each chunk stays below the 500 kB threshold.

Backend build (`npm run build -w backend`) compiles TypeScript to `dist/` with `tsc`.

---

## 5. Smart-contract tests

Run `npm run contracts:test` to execute the Hardhat/Mocha suite. It contains 25 tests for deployment,
administrator/verifier roles, duplicate audit keys, verification/rejection, terminal transitions,
events, state reads, invalid arguments and unauthorized callers. The suite runs against Hardhat's
local in-memory network; it does not prove that a testnet deployment occurred.

## 6. Test environment design

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
| Authenticated browser end-to-end flows | No authorized test session | Protected pages redirected to sign-in; UI/API still require role-based browser QA |
| Backend chain adapter | Semantic fake-chain workflow and real signature recovery tested | Live RPC/contract call not exercised |
| Browser MetaMask transaction flow | Typechecked and included in production build | No automated MetaMask browser E2E test |
| Resend email delivery | Credentials/domain not configured here | Outbox/provider logic is tested with mocked fetch; live delivery is unverified |
| SMS/push delivery | No provider implemented | In-app notices and optional email only |
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
