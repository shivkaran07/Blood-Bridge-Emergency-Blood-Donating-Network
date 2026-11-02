# Blockchain integration

## Current implementation

BloodBridge includes a working Solidity audit contract, Hardhat local-network configuration,
deployment/role scripts, wallet ownership challenge endpoints, and a backend ethers.js adapter. The
backend does not sign verifier transactions: an approved verifier must use their own wallet. The
backend independently checks the transaction receipt, chain ID, recipient, sender, contract event,
audit key and contract state before it updates the request to verified/rejected/completed.

The request-review UI can connect MetaMask, sign wallet-binding challenges, validate the selected
account and chain, submit the prepared contract call, and send its actual transaction hash to the
backend for confirmation. Open operations can be reused or reconciled without blindly creating
duplicate contract transactions. This browser-to-chain flow is implemented, but has not yet been
exercised against a live local RPC/Supabase setup.

## Contract and privacy

`contracts/contracts/BloodBridge.sol` stores only an opaque random `bytes32` request audit key,
status, acting wallet, and block timestamp. It stores no names, contact details, blood group,
location, request message, or patient/medical details. On-chain data is public and cannot be erased.
An event proves that the transaction was recorded; it does not prove the underlying request is true,
that a donor is eligible, or that blood was collected.

OpenZeppelin `AccessControl` protects `VERIFIER_ROLE`; only `DEFAULT_ADMIN_ROLE` can grant or revoke
it. The deploying address is the initial administrator and verifier. There are no token, payment,
or payable functions. Contract states are `NONE`, `VERIFIED`, `REJECTED`, `CANCELLED`, and
`COMPLETED`; only a `VERIFIED` record can be completed or cancelled, and terminal states cannot be
overwritten.

## Local setup

From the repository root:

```sh
npm install
npm run contracts:compile
npm run contracts:test
npm run chain
```

In another terminal, deploy to the local Hardhat node:

```sh
npm run contracts:deploy
```

The deployment script writes the address to ignored `backend/.env.local` and
`frontend/.env.local`, stores a local deployment record, and syncs the ABI. Grant the verifier role
to an approved hospital's verified wallet (replace with the actual wallet address):

```sh
set VERIFIER_ADDRESS=0x...
npm run contracts:grant-verifier
```

Configure the backend's database/Supabase settings using `backend/.env.example`. The backend chain
settings must match the deployed local contract and local RPC (`http://127.0.0.1:8545`, chain ID
31337). Development wallets exposed by Hardhat are public test keys; never use real assets or a
personal wallet's private key on this network.

## Backend workflow and API

1. An authenticated account obtains a short-lived, one-time challenge bound to its user ID and
   wallet address (`POST /api/v1/wallet/challenge`).
2. The account signs the exact message; the backend recovers the address and atomically consumes
   the challenge (`POST /api/v1/wallet/verify`). This proves control only, not hospital authority.
3. Hospital application approval, wallet binding and on-chain `VERIFIER_ROLE` are independently
   required before an anchor operation is prepared.
4. The backend stores a pending operation and returns its contract function/arguments.
5. After a verifier wallet submits the call, the API accepts the transaction hash and independently
   validates the receipt. Only confirmed expected events and matching contract state change the
   request's application status.
6. A database failure after chain success is flagged for reconciliation; the chain transaction is
   never erased. Failed/reverted attempts do not change the request decision.

Relevant API paths include `/api/v1/wallet/challenge`, `/api/v1/wallet/verify`,
`/api/v1/wallet/status`, `POST /api/v1/requests/:id/verify`,
`POST /api/v1/requests/:id/reject`, `POST /api/v1/requests/:id/chain-complete`,
`POST /api/v1/blockchain/operations/:id/confirm`, and
`POST /api/v1/blockchain/operations/:id/reconcile`. Authentication and application roles are
required; see [API docs](./API.md).

## Configuration and optional Sepolia

Backend configuration uses `BLOCKCHAIN_ENABLED`, `BLOCKCHAIN_NETWORK_NAME`,
`BLOCKCHAIN_CHAIN_ID`, `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_CONTRACT_ADDRESS`, confirmation count and
receipt timeout. The current default is **disabled / database mode** until a contract address and
enabled flag are configured. Never commit `.env`, testnet private keys, or RPC secrets. Sepolia
deployment is optional and requires a user-managed RPC endpoint, a test-only deployer key in
`DEPLOYER_PRIVATE_KEY`, and testnet funds. Mainnet deployment is not part of this project.

## Tests and known gaps

Run `npm run contracts:compile`, `npm run contracts:test`, and backend tests with `npm test -w
backend`. The contract suite covers roles, duplicate keys, state transitions, event emission and
reverts; backend tests use a semantic fake chain plus real signature cryptography. Neither is a
substitute for a full live local-RPC integration test. MetaMask transaction submission, explorer
links and the full UI reconciliation flow remain unfinished. Do not claim Sepolia or production
deployment has occurred.
