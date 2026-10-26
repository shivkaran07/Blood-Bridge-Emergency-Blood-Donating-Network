# Viva Preparation — BloodBridge Part 1

A study guide for explaining the project clearly and honestly. Each section gives the short answer
first, then the detail an examiner is likely to probe.

---

## 1. The 60-second explanation

> BloodBridge is a web application that connects four kinds of users during a blood emergency:
> requesters, donors, hospital verifiers and administrators. A requester creates a blood request.
> It starts as `SUBMITTED` and is invisible to donors until an **approved hospital verifier** reviews
> it in the application and moves it to `VERIFIED`. Only then can matching donors — same exact blood
> group, available, consenting to contact — see it and offer to help. The requester accepts or
> declines an offer, and phone numbers are revealed only when consent and acceptance both hold.
> Every important action is authorized on the server and written to an audit trail.
>
> Part 1 uses **database-backed** verification. The blockchain layer is deliberately not faked. The
> schema already stores an opaque audit key and a synchronization state, and there is a transaction
> table ready for Part 2, but no contract is deployed and no transaction is created.

That last paragraph is the one examiners remember. Never say "blockchain verified" about Part 1.

---

## 2. Why the project exists

**Problem.** In an emergency, people find donors through phone chains and social media. It is slow,
it exposes personal numbers widely, and there is no record of who confirmed the need.

**Approach.** Put the coordination into explicit roles and a recorded lifecycle:

- requesters state the need,
- hospitals confirm they reviewed it,
- donors see only verified, matching needs,
- contact details are shared only with consent,
- administrators oversee abuse and institutional approvals.

**What it is not.** Not an emergency service, not a blood bank, not a medical compatibility engine,
not a guarantee of availability.

---

## 3. Architecture

```
Browser (React + Vite + TypeScript + Tailwind + TanStack Query)
   │  Supabase Auth session (JWT)
   ▼
Express + TypeScript API (/api/v1)
   │  verify token -> load roles -> Zod validation -> rate limit
   │  services -> repositories -> parameterized SQL
   ▼
Supabase PostgreSQL (schema + RLS + audit trail)
```

Three points to emphasise:

1. **The browser never talks to the application tables directly.** It uses Supabase only to sign in.
   All business reads and writes go through the API.
2. **The server is the authorization boundary.** Hiding a button is UI convenience; the API re-checks
   everything.
3. **RLS is defence in depth.** It blocks direct browser access even if someone bypasses the UI.

Why not use Supabase client table APIs everywhere? Because request creation, status transitions,
donor responses, hospital decisions and audit writes need cross-table invariants and actor checks.
Putting them in the API centralizes the rules; RLS then acts as a second lock.

---

## 4. The four roles

| Role | How obtained | Main abilities |
| --- | --- | --- |
| `REQUESTER` | Chosen at registration | Create requests, cancel eligible ones, review offers, record completion |
| `DONOR` | Chosen at registration | Donor profile, availability, browse verified exact-group requests, offer/withdraw |
| `HOSPITAL` | **Only** by administrator approval of an application | Verification queue, verify/reject requests, institution review history |
| `ADMIN` | **Only** by the documented `grant-admin` script | Hospital approvals, user suspension, global request oversight, full audit log |

**Key viva point:** registration can only request `REQUESTER` or `DONOR`. The signup trigger reads
`account_type` metadata and rejects anything else, falling back to `REQUESTER`. A browser cannot
grant itself `HOSPITAL` or `ADMIN`. Hospital approval happens through an administrator decision;
admin access requires database-level access to run a script.

Why is role data not taken from the JWT? Because JWT metadata can be stale or user-influenced at
signup. The authoritative source is `public.user_roles`, loaded by the backend on each request.

---

## 5. Request lifecycle

```
SUBMITTED ──► UNDER_REVIEW ──► VERIFIED ──► PARTIALLY_FULFILLED ──► FULFILLED
    │              │              │
    ├──► CANCELLED ├──► REJECTED  ├──► CANCELLED
    └──► EXPIRED   └──► CANCELLED └──► EXPIRED
                                     └──► EXPIRED
```

Terminal states: `REJECTED`, `FULFILLED`, `CANCELLED`, `EXPIRED`.

Implementation: `backend/src/services/statusMachine.ts` holds one transition table. Every service
calls `assertRequestTransition` before writing. The database also constrains values with enums and
checks. No endpoint accepts a status from the client; instead there are action endpoints such as
`/verify`, `/reject`, `/cancel`, `/complete`.

Why centralize? So the rules cannot drift between controllers. Adding a state means changing one
table, not hunting through handlers.

**Subtle point examiners like:** verifying a `SUBMITTED` request first records
`SUBMITTED → UNDER_REVIEW`, then `UNDER_REVIEW → VERIFIED`. The history therefore shows the review
happened, rather than jumping straight to verified.

**Expiry:** Part 1 evaluates expiry when relevant endpoints run. There is no cron worker, so a
request may remain visibly open until something touches it. Documented as a limitation.

---

## 6. Donor responses

```
OFFERED ──► ACCEPTED ──► COMPLETED
   │            │
   ├──► DECLINED├──► WITHDRAWN
   ├──► WITHDRAWN
   └──► CANCELLED
```

- A donor can only respond if: request is `VERIFIED`/`PARTIALLY_FULFILLED`, not expired, donor is
  available, has the **exact same recorded blood group**, consents to contact, is not the requester,
  and has no active response already.
- A partial unique index enforces one active response per `(request_id, donor_id)` where status is
  `OFFERED`, `ACCEPTED` or `COMPLETED`.
- Requester accepts or declines an `OFFERED` response.
- Donor can decline or withdraw their own eligible response.
- Requester or an approved hospital can mark `ACCEPTED → COMPLETED`. This is an
  **acknowledgement**, not medical proof that blood was donated.
- Accepting an offer **never** changes the request to `FULFILLED`. Completion is a separate,
  authorized action.

Why keep these separate? Because "a donor said yes" and "the need was met" are different facts. The
design refuses to silently conflate them.

---

## 7. Matching

Matching is implemented in `requestService`:

1. Exact equality of the recorded blood group — **not** a compatibility matrix.
2. Donor `is_available = true`.
3. Donor `consent_to_contact = true`.
4. Request status is `VERIFIED` or `PARTIALLY_FULFILLED` and not past `needed_by`.
5. Donor is not the requester.
6. No existing active response from that donor.
7. Optional city/area filter.

If both the hospital coordinates and consented donor coordinates exist, the **server** computes
Haversine distance. Only an approximate distance is returned; exact coordinates and phone numbers
are never included in listings.

**Why not a compatibility engine?** Clinical compatibility depends on the recipient's antibodies,
cross-matching and a lab. A+ can often receive O+, but no responsible system should decide that in
JavaScript. The project states this explicitly in the UI and FAQ.

**Prepared statement:** "Matching is a coordination filter, not a medical decision."

---

## 8. Hospital verification (Part 1)

1. Any signed-in user may apply with institutional details.
2. Application starts as `PENDING`.
3. An administrator approves or rejects with a reason.
4. Approval inserts the `HOSPITAL` role and notifies the applicant. Rejection removes verifier
   access if it existed.
5. Approved verifiers get a pending queue, a review page and their institution's history.
6. Each verify/reject decision writes `request_status_history` and an `audit_events` row.
7. A verifier cannot review their own request.

**What verification means:** an approved hospital account recorded, in this application, that it
reviewed the request. It is **not** a blockchain transaction, clinical clearance, or proof that blood
is in stock.

**Why database-backed in Part 1?** Because implementing a contract and wallet properly takes real
work. Faking it — a hardcoded hash, a fake "confirmed" badge — would be dishonest and would make the
project's central claim meaningless. Part 1 builds the working application and leaves a clean seam.

---

## 9. Security

Be ready to name concrete controls, not generalities.

| Control | Where |
| --- | --- |
| Supabase Auth owns passwords | No password is stored in application tables |
| Bearer token verified server-side | `middleware/auth.ts` |
| Roles loaded from `user_roles`, not JWT claims | auth middleware |
| Suspended accounts rejected immediately | auth middleware |
| Zod validation, strict objects | `schemas/` |
| Parameterized SQL only | `repositories/` |
| Central transition machine | `statusMachine.ts` |
| Ownership checks in services | `access.ts` and services |
| RLS on every table | `20261026090100_rls_and_grants.sql` |
| Audit/blockchain writes backend-only | grants + policies |
| Helmet, CORS allow-list, rate limits | `app.ts`, `middleware/rateLimit.ts` |
| Structured logging with redaction | `lib/logger.ts` |
| Generic 500 responses, request IDs | error middleware |
| No fabricated transactions | blockchain service + UI |

**Privilege escalation examples to cite:**

- Registering with `account_type: "ADMIN"` → trigger forces `REQUESTER`/`DONOR`.
- Calling an admin endpoint as a donor → `403`.
- Calling verify as an unapproved hospital → `403`.
- Reading a submitted request as an unrelated user → `404` (existence hidden).
- Direct browser insert into `audit_events` → RLS denies.

**Honest caveats:** rate limits are in-memory (single process), there was no penetration test, and
hosted RLS was not verified against a live Supabase project.

---

## 10. Privacy

- Phone numbers are conditional fields in the DTO, not merely hidden in the UI.
  - Donor phone → requester/hospital only when donor consented **and** response is
    `ACCEPTED`/`COMPLETED`.
  - Requester phone → accepted donor only when the requester opted in.
- Exact coordinates are never returned; only approximate distance.
- Public messages are warned against patient identifiers.
- Audit metadata excludes tokens, passwords and full contact details.
- No medical history, diagnosis or eligibility data is collected.

Why return `null` instead of hiding in React? Because a hidden field is still in the network
response. The server must not send it.

---

## 11. Database design highlights

- `profiles.id` = `auth.users.id`: one identity, no duplicate user table.
- `user_roles` is authoritative; unique `(user_id, role)`.
- `donor_profiles`: one per user; coordinates both-or-neither; coordinates require consent.
- `blood_requests`: status, audit key, sync status, constraints.
- `request_status_history`: append-only with monotonic `seq`.
- `donor_responses`: partial unique index for active duplicates.
- `hospital_profiles`: unique user and registration number; approval requires reviewer + timestamp.
- `notifications`: recipient-scoped, read timestamp.
- `audit_events`: actor/request nullable so events survive deletion; JSON metadata.
- `blockchain_transactions`: constrained scaffold, empty in Part 1.

**Why `on delete restrict` for requests?** To protect history. Deleting a user should not silently
erase the record of requests they made.

**Why a partial unique index?** It allows a donor to withdraw and later re-offer, while preventing
two simultaneous active offers for the same request.

---

## 12. Part 2 (blockchain) — explain the plan, not a finished feature

Say plainly: **"Part 2 is not implemented."** Then describe the intended design:

- Solidity contract using OpenZeppelin `AccessControl`.
- Only **opaque audit keys** and action codes are anchored — never personal data.
- A wallet challenge (`nonce`, expiry, single use) binds an approved hospital to an address.
- The backend records `PENDING → SUBMITTED → CONFIRMED/FAILED` in `blockchain_transactions`.
- A hash and block number appear only after a real receipt.
- Database verification and on-chain anchoring remain **conceptually separate**.
- Hardhat local network first; Sepolia optional.

**Killer answer if asked "does the blockchain make it trustworthy?"**
"No. It makes a claim tamper-evident and publicly timestamped. It cannot make a false claim true,
and it does not replace clinical checks or hospital records."

---

## 13. Likely questions and short answers

**Q: Why not store everything on the blockchain?**
Cost, latency, privacy and the right to erasure. Personal and medical data should not go on a public
ledger. Only opaque commitments belong there.

**Q: Why Supabase?**
It provides managed PostgreSQL, Auth and RLS quickly. The backend still uses plain `pg` for data
access, so the application is not locked into Supabase client APIs.

**Q: Why an Express API instead of only Supabase client calls?**
Business invariants span multiple tables and need actor checks, audit and notifications. A single
server layer enforces them consistently; RLS cannot express all of those workflow rules.

**Q: How do you prevent duplicate requests?**
A service-level check plus a partial unique index on
`(requester_id, blood_group, hospital_name, needed_by)` for non-terminal statuses.

**Q: How do you prevent a donor from spamming offers?**
One active response per request, rate limits, and availability/consent requirements.

**Q: What happens when a request is rejected?**
It becomes terminal, leaves the donor feed, retains history and a reason, and the requester is
notified.

**Q: Can a hospital verify its own request?**
No. The service rejects self-review.

**Q: What if a verifier's account is suspended?**
The auth middleware rejects the token on the next request, even if the Supabase session is still
valid.

**Q: Where is the admin password?**
There is none. Admin access is granted by a script run with database credentials. No hardcoded
privileged account exists.

**Q: How is contact privacy enforced?**
Server-side DTO filtering based on consent and response status, not UI hiding.

**Q: What is the biggest limitation?**
The hosted Supabase path — authentication, migrations and RLS — was not executed against a live
project because no credentials were available. It is implemented but must be verified.

**Q: What would you do first with more time?**
Verify against a live Supabase project, add browser E2E tests, then build Part 2's contract and
wallet binding with real transaction reconciliation.

**Q: Is this production-ready?**
No. It is an educational prototype. Production needs a security audit, legal/data-protection
review, retention and deletion procedures, operational agreements with hospitals, and a shared rate
limit store.

---

## 14. Demo script (5 minutes)

1. Landing page — point out honest Part 1 wording and the two CTAs.
2. Register a donor; show that only requester/donor are offered.
3. Sign in as a requester; create a request; show status `SUBMITTED`.
4. Sign in as an approved hospital; open the queue; verify the request.
5. Sign in as the donor; show the verified request appearing only for the exact group; submit an
   offer.
6. Back as requester; accept the offer; show contact revealed only now.
7. Show the audit/history entries.
8. Open `/app/blockchain`; show that no transaction exists and read the explanation aloud.
9. Close with the Part 2 plan and the known limitations.

If a live Supabase project is unavailable, use the test suite output and the build result as
evidence, and state clearly what was not run.

---

## 15. Vocabulary to use precisely

| Term | Correct meaning here |
| --- | --- |
| Verification | A database record of an approved hospital's review decision |
| Anchoring | Committing an opaque key to a chain (Part 2 only) |
| Matching | Exact-group coordination filter |
| Compatibility | Clinical/laboratory determination — **not** implemented |
| Fulfilment | An authorized acknowledgement that the need was met |
| Completion (response) | Acknowledgement that a donor's offer concluded |
| Audit trail | Application database events, not an immutable ledger |
| RLS | PostgreSQL row-level policies limiting direct access |
| Service role | Server-only database credential that bypasses RLS |

---

## 16. Final honesty checklist

Before the viva, confirm you can say all of these without hedging:

- [ ] "Part 1 verification is database-backed, not blockchain."
- [ ] "No contract is deployed; no transaction exists."
- [ ] "Matching is exact-group, not medical compatibility."
- [ ] "Registration cannot create hospital or admin access."
- [ ] "The live Supabase path was not verified in this environment."
- [ ] "58 automated tests pass; 24 backend, 34 frontend."
- [ ] "The frontend build succeeds with a chunk-size warning."
- [ ] "This is an educational prototype, not a production emergency service."

Being able to state limitations confidently is stronger than overclaiming.
