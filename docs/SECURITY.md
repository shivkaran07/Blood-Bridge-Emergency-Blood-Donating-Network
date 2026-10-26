# Security

This document describes the security model actually implemented in Part 1, and the limitations a
real deployment would need to address.

---

## 1. Trust boundaries

```
Untrusted: browser, user input, URLs, tokens, headers
Trusted:   Express service process, server environment variables
Protected: Supabase database, audit trail, role assignments
```

The browser is never treated as an authorization authority. Hiding a button is convenience, not
security. Every protected API operation re-authenticates and re-checks permission.

---

## 2. Authentication

- Supabase Auth owns credentials and password hashing. BloodBridge stores **no passwords**.
- The browser holds the Supabase session; the access token is sent as a bearer token.
- The backend verifies the token with Supabase (`auth.getUser`) on every protected request.
- The backend then loads the profile, roles and account status from the database.
- Suspended accounts are rejected even with a valid Supabase token.
- Tokens are never written to logs or audit metadata.
- Session expiry and refresh are handled by Supabase; the frontend shows a recoverable error and
  the login redirect when the session is missing.
- Email confirmation and password policy are configured in the Supabase project. The application
  reports friendly messages for unconfirmed email, invalid credentials and rate limits.

### Registration cannot escalate privileges
- The form offers only `REQUESTER` and `DONOR`.
- The signup trigger forces the role to one of those two values.
- `HOSPITAL` is granted only by an administrator decision.
- `ADMIN` is provisioned only by `backend/scripts/grant-admin.ts`, run by an operator with database
  access. No hardcoded privileged account or password exists.

---

## 3. Authorization matrix

| Operation | Requester | Donor | Approved hospital | Admin |
| --- | --- | --- | --- | --- |
| View own profile / update permitted fields | ✅ | ✅ | ✅ | ✅ |
| Create request | ✅ | ✅ (as a requester) | — | ✅ |
| View own requests | ✅ | own only | ✅ (approved access) | ✅ |
| Cancel request | own, eligible | own, eligible | own, eligible | any eligible |
| Verify / reject request | ❌ | ❌ | ✅, not own request | ❌ via verification endpoint |
| Create donor profile / availability | own only | own only | own only | own only |
| Respond to request | ❌ (own) | eligible exact-group | ❌ | ❌ unless also a donor |
| View responses | own request | own responses | authorized requests | ✅ |
| Hospital queue / review history | ❌ | ❌ | ✅ | ✅ via admin views |
| Hospital application decision | ❌ | ❌ | ❌ | ✅ |
| Suspend accounts | ❌ | ❌ | ❌ | ✅ (not other admins) |
| Read full audit log | ❌ | ❌ | own institution reviews | ✅ |
| Write audit / blockchain rows | ❌ | ❌ | ❌ | ❌ (backend only) |

Additional rules:
- A verifier cannot verify or reject their own request.
- A donor cannot respond to their own request.
- Admin accounts cannot be suspended through the user-status endpoint.
- Self-role changes are not exposed by any endpoint.
- Unknown or unauthorized resources are often returned as `404` to avoid existence leaks.

---

## 4. Row Level Security

RLS is enabled on all application tables. Direct browser grants are revoked and then narrowed:

- `anon`: no application-table privileges.
- `authenticated`: narrow column-level selects and, for profiles/donor profiles, owner-only
  updates.
- Request lifecycle, responses, hospital decisions, roles, audit and blockchain rows are
  API-only writes.
- Helper functions are `SECURITY DEFINER` with a fixed `search_path` to avoid policy recursion and
  search-path attacks.

RLS is defence in depth; the service layer remains authoritative. Both must be maintained.

Automated tests exercise role escalation, ownership denial and RLS behaviour on the PGlite
database. Hosted Supabase RLS still requires verification with real credentials.

---

## 5. Input validation and injection

- All request bodies and many query strings are parsed by Zod schemas.
- Strict object schemas reject unexpected keys.
- Numeric ranges, string lengths, enums, UUIDs, dates and phone formats are checked.
- SQL is always parameterized through `pg`; no string interpolation of user values.
- Output is JSON rendered by React. The frontend does not use `dangerouslySetInnerHTML`.
- User-provided public messages are displayed as text, not interpreted as HTML.
- Validation errors return field details without SQL or stack traces.

---

## 6. Rate limiting and abuse resistance

- Global read/write limiters apply per IP.
- Stricter create limits apply to request creation, responses and hospital applications.
- Authentication rate limits are delegated to Supabase Auth.
- Duplicate active requests are blocked by a service check and a partial unique index.
- Duplicate active donor responses are blocked by a partial unique index.
- Administrator suspicious-request detection is a heuristic for operator review, not automated
  punishment.

Limitation: limiters are in-memory and per process. A multi-instance deployment needs a shared
store (for example Redis) and a trusted proxy configuration.

---

## 7. HTTP hardening

- Helmet sets security headers.
- CORS is an explicit allow-list; wildcard CORS is rejected in production.
- JSON body size is limited by Express middleware configuration.
- Unknown routes return JSON errors, not HTML stack traces.
- Request IDs support diagnosis without exposing internals.
- HTTPS is expected at the reverse proxy or hosting layer.

Production checklist:
- Set `NODE_ENV=production`.
- Set `TRUST_PROXY=true` only behind a trusted proxy.
- Use exact production origins in `CORS_ORIGINS`.
- Enforce HTTPS and HSTS at the edge.
- Keep dependencies patched.

---

## 8. Secrets management

- `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` exist only in backend environment variables.
- No secret is placed in a `VITE_` variable. The frontend config check rejects a
  `sb_secret_`/`service_role` value in the publishable-key slot.
- `.env` files are gitignored; only `.env.example` placeholders are committed.
- The backend refuses to start if placeholder credentials are still present.
- Logs redact authorization headers, cookies, tokens and sensitive bodies.
- Never log full request bodies for profile, donor or hospital endpoints in production.

If a service-role key is exposed: rotate it immediately in Supabase, audit access, and redeploy.
Rotating the publishable key alone is insufficient.

---

## 9. Privacy and data minimisation

- No medical history, diagnosis or eligibility data is collected.
- Location is optional, coarse by default, and coordinates require consent.
- Exact donor coordinates are never returned; only approximate distance.
- Donor phone numbers are revealed only with donor consent and an accepted/completed response.
- Requester phone numbers are revealed only to an accepted donor when the requester consented.
- Public request messages are limited and warned against containing patient identifiers.
- Audit metadata is non-sensitive and excludes tokens, passwords and full contact details.
- Dashboards show authorized aggregate counts, not other users' private records.

A production deployment would additionally need:
- a retention schedule,
- data-subject access/correction/deletion procedures,
- a documented breach-response process,
- a DPIA/legal review appropriate to the jurisdiction,
- encryption-at-rest verification and backup controls.

Part 1 has no self-service deletion/export UI.

---

## 10. Audit and non-repudiation

The application audit trail records actor, request, event type, metadata and time. Audit and
blockchain tables are not writable by browser clients. The trail is append-only by application
convention: services do not update or delete audit rows.

**This is not a blockchain guarantee.** A database administrator can still alter rows. Part 2's
on-chain anchoring is intended to provide tamper-evident external commitments for selected
verification actions. Even then, it will not make clinical data trustworthy or replace hospital
records.

---

## 11. Error handling

- Known errors map to stable HTTP codes and human-readable messages.
- Unexpected errors return a generic `500` with a request ID.
- Development logs may contain stack traces; production should keep them server-side.
- Empty catch blocks are avoided in business flows.
- Client retries are bounded; 4xx responses are not retried by TanStack Query.

---

## 12. Security testing performed

Backend tests cover:
- unauthenticated access denial,
- role permission enforcement,
- request ownership,
- donor-profile ownership,
- invalid state transitions,
- duplicate active responses,
- hospital verification permissions,
- privilege escalation attempts through registration/client calls,
- RLS read/write denial for unauthorized users.

Frontend tests cover protected-route redirects and configuration/error states.

Not performed:
- live Supabase hosted RLS verification,
- penetration testing,
- dependency CVE audit,
- load/DoS testing,
- browser E2E security flows.

These must be scheduled before any real deployment.

---

## 13. Remaining risks

| Risk | Severity | Mitigation status |
| --- | --- | --- |
| No hosted RLS verification | High for production | Documented; must verify with real project |
| Service-role compromise | Critical | Server-only storage, placeholder checks, rotation procedure documented |
| In-memory rate limits | Medium | Single-instance only; shared store needed for scale |
| Heuristic abuse detection | Medium | Human review; no automated bans |
| No account deletion/export | Medium (privacy) | Documented gap; add in later phase |
| No independent security audit | High for real use | Required before production |
| No on-chain proof in Part 1 | Expected | Clearly labelled; Part 2 scope |
