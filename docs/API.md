# API Reference

Base URL: `/api/v1`

## Conventions

- All protected endpoints require `Authorization: Bearer <supabase-access-token>`.
- Success responses: `{ "data": ... }`.
- Error responses: `{ "error": { "code", "message", "details"? }, "requestId"? }`.
- Validation errors use HTTP `422`; malformed requests `400`; missing/invalid auth `401`;
  authorization failures `403`; missing resources `404`; invalid lifecycle/duplicate operations
  `409`; rate limiting `429`.
- Bodies are JSON. Unknown body keys are rejected by strict schemas.
- Pagination uses `limit` (1–100, default 20) and `offset` (default 0).
- No endpoint accepts a client-supplied role or request status.

### Role guards

| Guard | Requirement |
| --- | --- |
| Authenticated | Valid token, active account, profile loaded |
| `requireApprovedHospital()` | `HOSPITAL` role **and** an `APPROVED` hospital profile |
| `requireAdmin()` | `ADMIN` role |

---

## 1. Health and metadata

### `GET /health` — public
Checks database reachability.

```json
{
  "data": {
    "status": "ok",
    "service": "bloodbridge-api",
    "database": "reachable",
    "phase": "PART_1",
    "time": "2026-10-26T00:00:00.000Z"
  }
}
```

### `GET /meta` — public
Returns phase and an explicit blockchain statement (`operational: false`, mode `DATABASE`).

---

## 2. Profile

### `GET /me` — authenticated
Returns the current user, profile, roles, permission flags, donor profile, hospital profile and
unread notification count.

### `PATCH /me` — authenticated, write-rate-limited
Body:

```json
{
  "fullName": "Asha Verma",
  "phoneNumber": "+91 90000 00000",
  "city": "Pune",
  "area": "Central district",
  "postalCode": "411001"
}
```

All fields are validated and trimmed. The account status and roles cannot be changed here.

---

## 3. Donor

### `GET /donor/profile` — authenticated
Returns the caller's donor profile or `null`.

### `PUT /donor/profile` — authenticated, write-rate-limited
Creates or updates the caller's donor profile.

```json
{
  "bloodGroup": "O-",
  "isAvailable": true,
  "consentToContact": true,
  "latitude": 18.5204,
  "longitude": 73.8567,
  "privacyAccepted": true
}
```

Rules: latitude/longitude must be supplied together, and coordinates require
`consentToContact: true`.

### `PATCH /donor/availability` — authenticated, write-rate-limited
```json
{ "isAvailable": false }
```

Affects only the caller's own donor profile.

---

## 4. Blood requests

### `GET /requests/feed` — authenticated
Query: `bloodGroup?`, `city?`, `limit?`, `offset?`.

Returns requests the viewer may see. For donors, the practical feed is verified/partially
fulfilled requests. Contact numbers and exact coordinates are not included unless a specific
consent/acceptance rule applies.

### `GET /requests/mine` — authenticated
Query: `status?`, `limit?`, `offset?`. Returns requests created by the caller.

### `POST /requests` — authenticated, create-rate-limited
Body:

```json
{
  "bloodGroup": "O-",
  "unitsRequested": 2,
  "hospitalName": "City General Hospital",
  "hospitalCity": "Pune",
  "hospitalArea": "Central district",
  "neededBy": "2026-10-27T10:00:00.000Z",
  "priority": "CRITICAL",
  "publicMessage": "Synthetic coordination message.",
  "contactPhone": "+91 90000 00000",
  "contactShareConsent": true,
  "accuracyConfirmed": true,
  "latitude": null,
  "longitude": null
}
```

Rules:
- units 1–20; `neededBy` must be in the future; message ≤ 500 chars;
- both consent/accuracy confirmations must be `true`;
- duplicate active requests produce `409`;
- created status is always `SUBMITTED`;
- the response contains the real status, audit key and `NOT_SCHEDULED` sync state.

### `GET /requests/:id` — authenticated
Returns the DTO if the caller is allowed to see it. Unauthorized visibility is reported as `404`.

### `GET /requests/:id/history` — authenticated
Status history ordered by sequence.

### `GET /requests/:id/matches` — authenticated
Authorized donor matches for a request. Exact-group, availability, consent and active-response
rules apply. Only approximate distance is returned.

### `GET /requests/:id/blockchain` — authenticated
Returns the prepared audit seam for the request. It does **not** fabricate transactions.

### `POST /requests/:id/respond` — authenticated, response-rate-limited
No body. Creates an `OFFERED` response for the caller. Requires an available, consenting donor
profile with the exact recorded blood group, an eligible request and no active duplicate response.

### `GET /requests/:id/responses` — requester or authorized hospital
Returns responses visible to the caller, with contact fields filtered by consent rules.

### `POST /requests/:id/cancel` — owner or admin
```json
{ "reason": "No longer required after hospital confirmation." }
```
Reason 5–500 chars. Only cancellable statuses are accepted. Active responses are cancelled and
participants are notified.

### `POST /requests/:id/complete` — owner or admin
```json
{ "status": "FULFILLED", "note": "Collected at the hospital." }
```
`status` is `PARTIALLY_FULFILLED` or `FULFILLED`. This is an application acknowledgement, not
medical proof.

### `POST /requests/:id/claim` — approved hospital
Moves an eligible request to `UNDER_REVIEW` and records history/audit.

### `POST /requests/:id/verify` — approved hospital
```json
{ "reason": "Institutional details confirmed by phone." }
```
Reason is optional. A `SUBMITTED` request first records `UNDER_REVIEW`, then `VERIFIED`. A verifier
cannot review their own request. This is database verification only.

### `POST /requests/:id/reject` — approved hospital
```json
{ "reason": "Hospital could not confirm the stated need." }
```
Reason 10–500 chars. Records `UNDER_REVIEW` where needed, then `REJECTED`.

---

## 5. Donor responses

### `GET /responses/mine` — authenticated
Query: `limit?`, `offset?`. Returns the caller's response history.

### `POST /responses/:id/decision` — request owner
```json
{ "decision": "ACCEPTED" }
```
`ACCEPTED` or `DECLINED`. Only `OFFERED` responses can be decided. Accepting does not fulfil the
request.

### `POST /responses/:id/withdraw` — donor
Withdraws the caller's eligible `OFFERED`/`ACCEPTED` response.

### `POST /responses/:id/decline` — donor
The donor declines their own eligible offer.

### `POST /responses/:id/complete` — request owner or approved hospital
Marks an `ACCEPTED` response `COMPLETED`. This is an acknowledgement, not proof of donation.

---

## 6. Hospital

### `POST /hospital/applications` — authenticated, hospital-rate-limited
```json
{
  "hospitalName": "City General Hospital",
  "registrationNumber": "REG-EXAMPLE-001",
  "contactPerson": "Dr Example",
  "contactPhone": "+91 90000 00000",
  "officialEmail": "verification@example.test",
  "address": "1 Example Road",
  "city": "Pune",
  "area": "Central district",
  "accuracyConfirmed": true
}
```
Creates or resubmits a `PENDING` application. Cannot grant any role by itself.

### `GET /hospital/application` — authenticated
Returns the caller's institutional application/status, or `null`.

### `GET /hospital/queue` — approved hospital
Query: `limit?`, `offset?`. Requests awaiting review, oldest first.

### `GET /hospital/dashboard` — approved hospital
Institution summary, pending count, own verified/rejected counts, queue preview and recent audit.

### `GET /hospital/audit` — approved hospital
Query: `limit?`, `offset?`. The caller institution's review decisions.

---

## 7. Notifications

### `GET /notifications` — authenticated
Query: `unreadOnly?` (boolean), `limit?`, `offset?`. Returns only the caller's notifications.

### `POST /notifications/:id/read` — authenticated, write-rate-limited
Marks one of the caller's notifications read. Ownership is enforced.

---

## 8. Dashboard

### `GET /dashboard` — authenticated
Returns role-specific dashboard data from the live database:
- requester counts and recent requests/responses,
- donor availability, verified feed preview and response activity,
- hospital pending/reviewed counts when the viewer is an approved verifier,
- admin summary when the viewer is an administrator,
- notification/activity data.

No fabricated platform statistics are returned.

---

## 9. Blockchain status (prepared, not active)

### `GET /blockchain/status` — authenticated
Returns:
- `prepared`, `enabledByConfiguration`, `contractAddressConfigured`,
- `networkName`, `chainId`, `verificationMode: "DATABASE"`,
- sync counts including `NOT_SCHEDULED`,
- recent transactions (empty in Part 1),
- an explanation and Part 2 hand-off text.

No endpoint creates a blockchain transaction in Part 1.

---

## 10. Administrator

All routes below require `ADMIN`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/overview` | Aggregate dashboard, pending applications, suspicious count, recent audit, activity series |
| `GET` | `/admin/stats` | Aggregate statistics only |
| `GET` | `/admin/users` | Paginated user search (`search?`, `limit?`, `offset?`) |
| `PATCH` | `/admin/users/:id/status` | `{ status: "ACTIVE" \| "SUSPENDED", reason? }`; admins cannot be suspended here |
| `GET` | `/admin/requests` | Filter by `status?`, `bloodGroup?`, `priority?`, `city?`, `search?`, pagination |
| `POST` | `/admin/requests/:id/cancel` | `{ reason }` (10–500 chars) |
| `GET` | `/admin/suspicious` | Heuristic suspicious-pattern list |
| `GET` | `/admin/audit` | Filter by `eventType?`, `requestId?`, `actorUserId?`, pagination |
| `GET` | `/admin/hospital-applications` | Filter by `status?`, pagination |
| `POST` | `/admin/hospital-applications/:id/decision` | `{ decision: "APPROVED" \| "REJECTED", reason? }` |

Approving a hospital application grants the `HOSPITAL` role. It never grants `ADMIN`.

---

## 11. Response DTO notes

- `BloodRequest.verification` explicitly states `mode: "DATABASE"` and
  `blockchainVerified: false` in Part 1.
- Contact phone fields are `null` unless the consent/acceptance conditions are met.
- `permissions` describes what the current viewer may do; the backend re-checks independently.
- Status fields are strings from the documented enums.
- Timestamps are ISO strings.

See `frontend/src/types/api.ts` and `backend/src/services/serializers.ts` for the exact DTO shape.
