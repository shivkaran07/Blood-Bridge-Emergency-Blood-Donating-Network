# Blockchain Integration — Part 1 State and Part 2 Plan

> **Read this first.** BloodBridge Part 1 does **not** use a blockchain. No Solidity contract is
> deployed, no wallet is connected, no RPC node is contacted and no transaction is created. The
> application describes its verification as **database-backed** everywhere in the UI and API. This
> document explains what *is* prepared, why it is prepared that way, and what Part 2 must actually
> build.

---

## 1. What Part 1 implements

Part 1 implements the **seam** for a later on-chain audit anchor. Nothing more.

| Item | Location | Part 1 behaviour |
| --- | --- | --- |
| Opaque audit key | `blood_requests.blockchain_audit_key` | 64 lowercase hex chars, generated with `crypto.randomBytes(32)` at request creation time |
| Synchronization state | `blood_requests.blockchain_sync_status` | Always created as `NOT_SCHEDULED`; no code advances it |
| Transaction scaffold | `blockchain_transactions` table | Exists with constraints and indexes; **no application code inserts rows** |
| Read-only status API | `GET /api/v1/blockchain/status` | Returns `operational: false`, `connected: false`, `verificationMode: "DATABASE"` |
| Per-request audit view | `GET /api/v1/requests/:id/blockchain` | Returns the audit key and an empty transaction list |
| Verification DTO | `serializers.ts` / `frontend/src/types/api.ts` | `mode: "DATABASE"`, `blockchainVerified: false` |
| UI page | `/app/blockchain` | Explains the boundary; shows an honest empty state |
| Environment placeholders | `backend/src/config/env.ts` | `BLOCKCHAIN_*` values are read but cannot make the integration operational |

The audit key is deliberately **opaque**. It contains no user ID, blood group, hospital name, phone
number or timestamp. This matters for Part 2: anchoring a random nonce on a public chain leaks
nothing about the person or the medical request, while still allowing the operator to prove that a
particular record existed in a particular form at a particular time.

### Why keep the key if nothing uses it?

Because retrofitting identity into historical rows is error-prone. When Part 2 anchors a request,
it must anchor a value that was fixed **before** the anchor existed. Generating the key at request
creation avoids a migration that back-fills identifiers for already-verified requests.

---

## 2. Why database verification is not blockchain verification

These are different guarantees:

| Property | Database verification (Part 1) | On-chain anchoring (Part 2) |
| --- | --- | --- |
| Who can assert it | An approved hospital verifier, through the API | An authorized verifier wallet, through a signed transaction |
| Where it lives | `public.blood_requests` + `request_status_history` | A smart contract event / storage entry |
| Who can alter it | A database administrator can | Practically immutable once confirmed |
| Who can read it | Authorized application users | Anyone, including people outside the application |
| What it proves | "This hospital account reviewed this request in BloodBridge" | "This exact audit key was committed at this block time" |
| What it does **not** prove | Clinical compatibility, stock, donor eligibility, truthfulness | The same — an anchor proves commitment, not correctness |

A blockchain anchor does not make a false claim true. If a verifier approves a fraudulent request,
the anchor makes that approval permanently *visible*, not *correct*. This distinction must survive
into Part 2 documentation and the viva.

---

## 3. Schema already in place

### 3.1 `blood_requests` columns

```sql
blockchain_audit_key   text not null
  check (blockchain_audit_key ~ '^[a-f0-9]{64}$')
  unique,

blockchain_sync_status public.blockchain_sync_status
  not null default 'NOT_SCHEDULED'
```

### 3.2 `blockchain_sync_status` enum

| Value | Intended meaning in Part 2 |
| --- | --- |
| `NOT_SCHEDULED` | No anchor attempt has been made (all Part 1 rows) |
| `AWAITING_WALLET` | A verifier action requested an anchor; wallet confirmation is pending |
| `SUBMITTED` | A transaction hash exists; confirmation is pending |
| `CONFIRMED` | The transaction is mined and the receipt matches the expected event |
| `FAILED` | Submission or confirmation failed permanently; the database verification still stands |

Part 1 only ever produces `NOT_SCHEDULED`. The enum values are **not** cosmetic claims — nothing in
the codebase writes the other values.

### 3.3 `blockchain_transactions`

```sql
id                 uuid primary key
request_id         uuid not null  -> blood_requests(id) on delete cascade
blockchain_audit_key text not null          -- must match the request's key by convention
network_name       text not null
chain_id           bigint not null
contract_address   text not null            -- 0x + 40 hex
transaction_hash   text                     -- 0x + 64 hex, unique when present
action             text not null            -- e.g. ANCHOR_VERIFICATION
transaction_status blockchain_transaction_status not null default 'PENDING'
block_number       bigint
actor_user_id      uuid  -> profiles(id) on delete set null
created_at, updated_at timestamptz
```

Constraints that matter for Part 2 correctness:

- `CONFIRMED` rows **must** have both a transaction hash and a block number. The database itself
  refuses to store an unconfirmed "confirmed" claim.
- `transaction_hash` is unique when present, preventing double-recording of one hash.
- `contract_address` and `transaction_hash` formats are validated by `CHECK` constraints.
- `blockchain_sync_status` and `blockchain_transaction_status` are separate enums on purpose: the
  request-level state is a summary; the transaction-level state is the auditable fact.

### 3.4 Access rules

- `blockchain_transactions` has RLS enabled.
- Browser roles have **no write** privilege.
- Only administrators may select rows directly.
- The API exposes only the prepared, read-only views described above.

---

## 4. Intended Part 2 architecture

```
Approved verifier (browser)
   │ 1. MetaMask connects
   │ 2. POST /wallet/challenge  -> server nonce
   │ 3. personal_sign(challenge)
   │ 4. POST /wallet/verify     -> wallet bound to hospital profile
   │
   ▼
Express API
   │ 5. verify + reject request normally (database transaction)
   │ 6. create blockchain_transactions row (PENDING)
   │ 7. send tx via ethers.js using the verifier's wallet or a relayer
   ▼
Solidity contract (AccessControl)
   │ 8. emit VerificationAnchored(auditKey, action, actor, timestamp)
   ▼
RPC node / Hardhat / Sepolia
   │ 9. receipt -> block number
   ▼
Express API
   │ 10. update transaction row to CONFIRMED with real hash + block
   │ 11. update request.blockchain_sync_status to CONFIRMED
   ▼
UI shows "on-chain anchored" — separately from "database verified"
```

### 4.1 Contract sketch (not yet written)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract BloodBridgeAudit is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    event VerificationAnchored(
        bytes32 indexed auditKey,
        bytes32 indexed action,
        address indexed actor,
        uint64 timestamp
    );

    error AlreadyAnchored(bytes32 auditKey);

    mapping(bytes32 => bool) private _anchored;

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function anchor(bytes32 auditKey, bytes32 action) external onlyRole(VERIFIER_ROLE) {
        if (_anchored[auditKey]) revert AlreadyAnchored(auditKey);
        _anchored[auditKey] = true;
        emit VerificationAnchored(auditKey, action, msg.sender, uint64(block.timestamp));
    }

    function isAnchored(bytes32 auditKey) external view returns (bool) {
        return _anchored[auditKey];
    }
}
```

Design notes:

- Only **hashes** go on-chain. The audit key is already opaque; no personal data is ever sent.
- `action` is a code (for example `keccak256("VERIFY")`), not free text.
- Duplicate anchors revert, so a replayed request cannot overwrite history.
- No upgradeability. An auditable append-only record is more useful than a mutable proxy here.
- Role administration stays with a deploy-time admin; the backend never holds that key.

### 4.2 Wallet identity

A wallet address alone is not an identity. Part 2 needs a challenge/response binding:

1. `POST /wallet/challenge` returns a random nonce, a human-readable message including the domain
   and expiry, and stores `(user_id, nonce, expires_at, used_at)` in a new table.
2. The browser calls `personal_sign(message, address)`.
3. `POST /wallet/verify` recovers the address, checks the nonce is unused and unexpired, marks it
   used, and stores the address on the approved hospital profile.
4. Only then may that hospital submit anchor transactions.

Replay protection is essential: nonce single-use, short expiry, bound to the authenticated user,
and never reused across chain IDs or contract addresses.

### 4.3 Failure handling

| Failure | Required behaviour |
| --- | --- |
| User rejects MetaMask prompt | Transaction row stays `PENDING`; request remains database-verified; UI says "not anchored" |
| RPC unreachable | Mark `FAILED` after bounded retries; never fake a hash |
| Transaction reverts | Mark `FAILED` with the revert reason code; do not retry blindly |
| Submitted but never mined | Keep `SUBMITTED`; a reconciliation job checks the receipt later |
| Confirmed but event missing/mismatched | Mark `FAILED`; do not set request status to `CONFIRMED` |
| Duplicate anchor attempt | `AlreadyAnchored` revert is surfaced as an existing-anchor success, not a new transaction |

The governing rule: **the database must never claim a state the chain has not reached.** A failed
anchor is acceptable; a fabricated confirmation is not.

### 4.4 New migration required in Part 2

```sql
create table public.wallet_bindings (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  wallet_address text not null unique,
  chain_id      bigint not null,
  verified_at   timestamptz not null default now()
);

create table public.wallet_challenges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  nonce      text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz
);
```

Both tables are backend-only for writes; RLS should allow a user to read only their own binding.

---

## 5. What the UI must say in Part 2

Acceptable wording:

- "Database verified — anchored on chain" only after `blockchain_sync_status = CONFIRMED`.
- "Database verified — on-chain anchor pending" while `AWAITING_WALLET`/`SUBMITTED`.
- "Database verified — on-chain anchor failed" for `FAILED`, with a retry action.
- A transaction hash and block number only when they came from a real receipt.

Unacceptable wording, in any phase:

- "Blockchain verified" as a synonym for "a hospital approved it".
- A fake hash such as `0x000...`, a placeholder block number, or a demo transaction row.
- "Immutable" or "trustless" without explaining what is actually anchored.
- Any claim that the chain validates medical compatibility, stock or donor eligibility.

---

## 6. Honest limitations of an on-chain audit approach

1. **Garbage in, permanent garbage out.** Anchoring does not validate the claim.
2. **Metadata leakage.** Transaction timing, verifier wallet and frequency are public. Even opaque
   keys can be correlated if the operator publishes a mapping.
3. **Cost and latency.** Every anchor costs gas and takes block time; emergency workflows cannot
   block on it.
4. **Key management.** A verifier wallet is a new high-value secret. Compromise means forged
   anchors.
5. **Identity gap.** A wallet proves control of a key, not employment at a hospital. Institutional
   binding still depends on administrator approval in the database.
6. **Regulatory scope.** On-chain personal data can conflict with erasure obligations, which is
   exactly why only opaque hashes are anchored.
7. **No privacy guarantee.** A public chain reveals that *some* verification happened at a time,
   even if not what it was about.

These are documented so the project does not overstate what Part 2 will achieve.

---

## 7. Suggested Part 2 build order

1. Contract + Hardhat config + OpenZeppelin dependency.
2. Contract tests: role enforcement, duplicate revert, event emission, `isAnchored`.
3. Wallet migrations and challenge/verify endpoints with replay tests.
4. Transaction repository writes (insert `PENDING`, then transition).
5. `ethers.js` integration behind the existing service interface.
6. Receipt reconciliation and failure states.
7. Frontend wallet connection, network guard, pending/failed/confirmed states.
8. End-to-end run on the Hardhat local network; optional Sepolia deployment.
9. Documentation and viva update with real hashes and real limitations.

Do **not** restructure the existing schema or services. The seam was designed so Part 2 extends it
rather than replaces it.
