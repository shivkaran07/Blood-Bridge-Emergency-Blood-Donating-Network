import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { Wallet } from 'ethers';

import {
  bearer,
  createTestApp,
  createTestDb,
  createUser,
  testConfig,
  type PgliteDb,
  type TestUser,
} from './helpers.js';
import type {
  AnchorExpectation,
  AnchorVerification,
  ChainAdapter,
  ChainHealth,
  OnChainStatus,
} from '../blockchain/adapter.js';

const CONTRACT_ADDRESS = '0x' + 'bb'.repeat(20);
const VERIFIER_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'; // hardhat #2
const OTHER_KEY = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'; // hardhat #3
const THIRD_KEY = `0x${'3'.padStart(64, '0')}`;
const FOURTH_KEY = `0x${'4'.padStart(64, '0')}`;
const NEEDED_BY = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const txHash = (seed: string) => `0x${seed.padEnd(64, '0')}`;

/**
 * Semantic fake of the chain: real wallet cryptography is used (ethers
 * signMessage / verifyMessage), but no Ethereum network is spun up. The fake
 * records what a REAL BloodBridge deployment would return so all backend
 * rules - receipts, sender, events, contract state - are exercised honestly.
 */
class FakeChainAdapter implements ChainAdapter {
  readonly verificationMode = 'ON_CHAIN' as const;
  readonly verifiers = new Set<string>();
  readonly onChain = new Map<string, OnChainStatus>();
  private script:
    | null
    | ((hash: string, expectation: AnchorExpectation) => AnchorVerification) = null;

  contractAddress(): string | null {
    return CONTRACT_ADDRESS;
  }

  async getHealth(): Promise<ChainHealth> {
    return { connected: true, chainId: 31337, latestBlock: 21, error: null };
  }

  async isVerifier(address: string): Promise<boolean> {
    return this.verifiers.has(address.toLowerCase());
  }

  async getOnChainStatus(auditKey: string): Promise<OnChainStatus> {
    return this.onChain.get(`0x${auditKey.toLowerCase()}`) ?? 'NONE';
  }

  /** Overrides the verification result of exactly the next call. */
  once(script: NonNullable<FakeChainAdapter['script']>): void {
    const previous = this.script;
    this.script = (hash, expectation) => {
      this.script = previous;
      return script(hash, expectation);
    };
  }

  async verifyAnchorTx(
    hash: string,
    expectation: AnchorExpectation,
  ): Promise<AnchorVerification> {
    if (this.script) return this.script(hash, expectation);
    // Default: the transaction succeeded and updated the contract state, as a
    // real receipts lookup would observe it.
    this.onChain.set(`0x${expectation.auditKey}`, expectation.expectedToStatus);
    return {
      ok: true,
      transactionHash: hash,
      chainId: 31337,
      contractAddress: expectation.contractAddress,
      blockNumber: 77,
      fromAddress: expectation.expectedFrom,
      toAddress: expectation.contractAddress,
      contractStatus: expectation.expectedToStatus,
      eventStatus: expectation.expectedToStatus,
      eventActor: expectation.expectedFrom,
      eventBlockTimestampSeconds: 1234,
    };
  }
}

const chainConfig = testConfig({
  blockchain: {
    ...testConfig().blockchain,
    enabled: true,
    contractAddress: CONTRACT_ADDRESS,
    walletChallengeTtlSeconds: 120,
    confirmations: 1,
    receiptTimeoutMs: 5_000,
  },
});

async function bindWallet(
  app: Express,
  db: PgliteDb,
  user: TestUser,
  walletAddress: string,
  signingKey: string = VERIFIER_KEY,
): Promise<void> {
  const challenge = await request(app)
    .post('/api/v1/wallet/challenge')
    .set('Authorization', bearer(user))
    .send({ walletAddress })
    .expect(201);
  const signature = await new Wallet(signingKey).signMessage(challenge.body.data.message);
  const verify = await request(app)
    .post('/api/v1/wallet/verify')
    .set('Authorization', bearer(user))
    .send({ message: challenge.body.data.message, signature });
  expect(verify.status).toBe(200);
  expect(verify.body.data.walletAddress).toBe(walletAddress.toLowerCase());
  void db;
}

describe('blockchain verification anchoring (Part 2)', () => {
  let db: PgliteDb;
  let app: Express;
  let chain: FakeChainAdapter;
  let requester: TestUser;
  let donor: TestUser;
  let hospital: TestUser;
  let admin: TestUser;
  let requestId: string;

  let requestCounter = 0;
  // Returns the supertest Test (thenable), so callers can both `await` it and
  // attach extra `.expect(...)` assertions. Each request gets its own deadline:
  // identical blood group + neededBy would trip the duplicate-request guard.
  const createRequest = (user: TestUser, hospitalName = 'Anchor Hospital') => {
    requestCounter += 1;
    const neededBy = new Date(
      Date.now() + (6 + requestCounter) * 60 * 60 * 1000,
    ).toISOString();
    return request(app)
      .post('/api/v1/requests')
      .set('Authorization', bearer(user))
      .send({
        bloodGroup: 'O-',
        unitsRequested: 1,
        hospitalName,
        hospitalCity: 'Pune',
        hospitalArea: 'Hadapsar',
        neededBy,
        priority: 'URGENT',
        contactPhone: '+919876543210',
        contactShareConsent: true,
        accuracyConfirmed: true,
      });
  };

  beforeAll(async () => {
    db = await createTestDb();
    chain = new FakeChainAdapter();
    app = createTestApp(db, chainConfig, chain);

    requester = await createUser(db, { email: 'chain-requester@example.com', fullName: 'Rak Requester' });
    donor = await createUser(db, {
      email: 'chain-donor@example.com',
      fullName: 'Dil Donor',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });
    hospital = await createUser(db, { email: 'chain-hospital@example.com', fullName: 'Hari Hospital' });
    admin = await createUser(db, { email: 'chain-admin@example.com', fullName: 'Aja Admin', roles: ['ADMIN'] });

    // Approved hospital through the real application flow.
    await request(app)
      .post('/api/v1/hospital/applications')
      .set('Authorization', bearer(hospital))
      .send({
        hospitalName: 'Anchor Hospital',
        registrationNumber: 'MH-PUNE-9001',
        contactPerson: 'Dr Hari',
        contactPhone: '+912012345678',
        officialEmail: 'hod@anchor.example',
        address: '9 Anchor Road, Pune',
        city: 'Pune',
        area: 'Hadapsar',
        accuracyConfirmed: true,
      })
      .expect(201);
    const pending = await request(app)
      .get('/api/v1/admin/hospital-applications?status=PENDING')
      .set('Authorization', bearer(admin))
      .expect(200);
    await request(app)
      .post(`/api/v1/admin/hospital-applications/${pending.body.data.items[0].id}/decision`)
      .set('Authorization', bearer(admin))
      .send({ decision: 'APPROVED' })
      .expect(200);

    const created = await createRequest(requester).expect(201);
    requestId = created.body.data.id;
  });

  afterAll(async () => {
    await db.close();
  });

  // ------------------------------------------------------------------ wallet
  it('binds a wallet only after a cryptographically valid signature', async () => {
    const verifierAddress = await new Wallet(VERIFIER_KEY).getAddress();
    const challenge = await request(app)
      .post('/api/v1/wallet/challenge')
      .set('Authorization', bearer(hospital))
      .send({ walletAddress: verifierAddress })
      .expect(201);
    expect(challenge.body.data.message).toContain('BloodBridge');
    expect(challenge.body.data.message).toContain(verifierAddress.toLowerCase());
    expect(challenge.body.data.message).toContain('does NOT approve any transaction');

    const signature = await new Wallet(VERIFIER_KEY).signMessage(challenge.body.data.message);
    const verified = await request(app)
      .post('/api/v1/wallet/verify')
      .set('Authorization', bearer(hospital))
      .send({ message: challenge.body.data.message, signature })
      .expect(200);
    expect(verified.body.data.walletAddress).toBe(verifierAddress.toLowerCase());
    expect(verified.body.data.chainId).toBe(31337);

    const status = await request(app)
      .get('/api/v1/wallet/status')
      .set('Authorization', bearer(hospital))
      .expect(200);
    expect(status.body.data.bound).toBe(true);
    // Binding alone never grants on-chain rights.
    expect(status.body.data.hasOnChainVerifierRole).toBe(false);
  });

  it('rejects a signature made with a different wallet', async () => {
    const intended = await new Wallet(THIRD_KEY).getAddress();
    const challenge = await request(app)
      .post('/api/v1/wallet/challenge')
      .set('Authorization', bearer(requester))
      .send({ walletAddress: intended })
      .expect(201);
    const wrongSignature = await new Wallet(OTHER_KEY).signMessage(challenge.body.data.message);
    await request(app)
      .post('/api/v1/wallet/verify')
      .set('Authorization', bearer(requester))
      .send({ message: challenge.body.data.message, signature: wrongSignature })
      .expect(422);

    // The failed attempt must not have bound anything.
    const status = await request(app)
      .get('/api/v1/wallet/status')
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(status.body.data.bound).toBe(false);
  });

  it('never replays a consumed challenge', async () => {
    const verifierAddress = await new Wallet(FOURTH_KEY).getAddress();
    const challenge = await request(app)
      .post('/api/v1/wallet/challenge')
      .set('Authorization', bearer(requester))
      .send({ walletAddress: verifierAddress })
      .expect(201);
    const signature = await new Wallet(FOURTH_KEY).signMessage(challenge.body.data.message);
    await request(app)
      .post('/api/v1/wallet/verify')
      .set('Authorization', bearer(requester))
      .send({ message: challenge.body.data.message, signature })
      .expect(200);

    const replay = await request(app)
      .post('/api/v1/wallet/verify')
      .set('Authorization', bearer(requester))
      .send({ message: challenge.body.data.message, signature })
      .expect(409);
    expect(replay.body.error.message).toContain('already used');
  });

  it('rejects challenges after their expiry', async () => {
    const walletAddress = await new Wallet(OTHER_KEY).getAddress();
    const challenge = await request(app)
      .post('/api/v1/wallet/challenge')
      .set('Authorization', bearer(donor))
      .send({ walletAddress })
      .expect(201);

    await db.query(
      `update public.wallet_challenges set expires_at = now() - interval '1 hour' where user_id = $1`,
      [donor.id],
    );
    const signature = await new Wallet(OTHER_KEY).signMessage(challenge.body.data.message);
    await request(app)
      .post('/api/v1/wallet/verify')
      .set('Authorization', bearer(donor))
      .send({ message: challenge.body.data.message, signature })
      .expect(409);
  });

  it('prevents one wallet from being bound by a second account', async () => {
    const secondRequester = await createUser(db, {
      email: 'chain-second-requester@example.com',
      fullName: 'Sak Second',
    });
    const verifierAddress = await new Wallet(VERIFIER_KEY).getAddress();
    const challenge = await request(app)
      .post('/api/v1/wallet/challenge')
      .set('Authorization', bearer(secondRequester))
      .send({ walletAddress: verifierAddress })
      .expect(409);
    expect(challenge.body.error.message).toContain('already bound to a different account');
  });

  // ---------------------------------------------------------------- prepare
  it('refuses anchors for verifiers without an on-chain VERIFIER_ROLE', async () => {
    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Looks legitimate.' })
      .expect(403);
    expect(response.body.error.message).toContain('VERIFIER_ROLE');
    // Nothing pending was created by the refused attempt.
    const record = await request(app)
      .get(`/api/v1/requests/${requestId}/blockchain`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(record.body.data.transactions).toHaveLength(0);
  });

  it('refuses an account that has not verified a wallet binding', async () => {
    const unboundHospital = await createUser(db, {
      email: 'chain-unbound@example.com',
      fullName: 'Uma Unbound',
    });
    await request(app)
      .post('/api/v1/hospital/applications')
      .set('Authorization', bearer(unboundHospital))
      .send({
        hospitalName: 'Unbound Hospital',
        registrationNumber: 'MH-PUNE-9002',
        contactPerson: 'Dr Uma',
        contactPhone: '+912012345679',
        officialEmail: 'hod@unbound.example',
        address: '10 Unbound Road, Pune',
        city: 'Pune',
        area: 'Kothrud',
        accuracyConfirmed: true,
      })
      .expect(201);
    const pending = await request(app)
      .get('/api/v1/admin/hospital-applications?status=PENDING')
      .set('Authorization', bearer(admin))
      .expect(200);
    await request(app)
      .post(`/api/v1/admin/hospital-applications/${pending.body.data.items[0].id}/decision`)
      .set('Authorization', bearer(admin))
      .send({ decision: 'APPROVED' })
      .expect(200);

    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(unboundHospital))
      .send({ reason: 'Trying without a wallet.' })
      .expect(403);
    expect(response.body.error.message).toContain('wallet');
  });

  it('prepares an anchor operation with the wallet target and keeps the DB decision pending', async () => {
    const verifierAddress = await new Wallet(VERIFIER_KEY).getAddress();
    chain.verifiers.add(verifierAddress.toLowerCase());

    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Confirmed with the blood bank.' })
      .expect(200);
    expect(response.body.data.mode).toBe('ON_CHAIN');
    const operation = response.body.data.operation;
    expect(operation.functionName).toBe('recordVerifiedRequest');
    expect(operation.args).toEqual([
      `0x${response.body.data.operation.auditKey}`,
    ]);
    expect(operation.expectedStatus).toBe('VERIFIED');
    expect(operation.expectedFromAddress).toBe(verifierAddress.toLowerCase());
    expect(operation.contractAddress).toBe(CONTRACT_ADDRESS);
    expect(operation.chainId).toBe(31337);

    // The database decision has NOT changed yet - only the anchor exists.
    const detail = await request(app)
      .get(`/api/v1/requests/${requestId}`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(detail.body.data.status).toBe('UNDER_REVIEW');
    expect(detail.body.data.blockchainSyncStatus).toBe('AWAITING_WALLET');

    const mine = await request(app)
      .get('/api/v1/blockchain/operations')
      .set('Authorization', bearer(hospital))
      .expect(200);
    const pendingOp = mine.body.data.items.find(
      (item: { id: string }) => item.id === operation.operationId,
    );
    expect(pendingOp.status).toBe('PENDING');

    // A second open operation is refused; no auto-created duplicate tx.
    const duplicate = await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Trying again.' })
      .expect(409);
    expect(duplicate.body.error.details.existingOperationId).toBe(operation.operationId);
  });

  it('refuses anchors of a requester on its own request', async () => {
    // The hospital creates its own request - anchor preparation must refuse.
    const own = await createRequest(hospital, 'Anchor Hospital West').expect(201);
    const response = await request(app)
      .post(`/api/v1/requests/${own.body.data.id}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Self verification attempt.' })
      .expect(403);
    expect(response.body.error.message).toContain('own blood request');
  });

  // ---------------------------------------------------------------- confirm
  it('confirms the wallet transaction and only then moves the DB status', async () => {
    const operation = (
      await request(app)
        .get('/api/v1/blockchain/operations?status=PENDING')
        .set('Authorization', bearer(hospital))
        .expect(200)
    ).body.data.items[0];
    expect(operation).toBeTruthy();

    const confirm = await request(app)
      .post(`/api/v1/blockchain/operations/${operation.id}/confirm`)
      .set('Authorization', bearer(hospital))
      .send({ transactionHash: txHash('aa1') })
      .expect(200);
    expect(confirm.body.data.status).toBe('CONFIRMED');
    expect(confirm.body.data.transactionHash).toBe(txHash('aa1'));
    expect(confirm.body.data.request.status).toBe('VERIFIED');
    expect(confirm.body.data.request.blockchainSyncStatus).toBe('CONFIRMED');
    expect(confirm.body.data.request.verification.mode).toBe('ON_CHAIN');
    expect(confirm.body.data.request.verification.blockchainVerified).toBe(true);

    // Full audit trail: history + operation row.
    const history = await request(app)
      .get(`/api/v1/requests/${requestId}/history`)
      .set('Authorization', bearer(requester))
      .expect(200);
    const verifiedEntry = history.body.data.find(
      (row: { toStatus: string }) => row.toStatus === 'VERIFIED',
    );
    expect(verifiedEntry.reason).toContain('Recorded on chain');

    // Requester notification.
    const notifications = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(
      notifications.body.data.items.some(
        (item: { type: string }) => item.type === 'REQUEST_VERIFIED',
      ),
    ).toBe(true);
  });

  it('is idempotent when the same receipt is confirmed twice', async () => {
    const operation = (
      await request(app)
        .get(`/api/v1/blockchain/operations?requestId=${requestId}`)
        .set('Authorization', bearer(admin))
        .expect(200)
    ).body.data.items[0];

    const again = await request(app)
      .post(`/api/v1/blockchain/operations/${operation.id}/confirm`)
      .set('Authorization', bearer(hospital))
      .send({ transactionHash: txHash('aa1') })
      .expect(200);
    expect(again.body.data.status).toBe('CONFIRMED');

    const history = await request(app)
      .get(`/api/v1/requests/${requestId}/history`)
      .set('Authorization', bearer(requester))
      .expect(200);
    const verifiedCount = history.body.data.filter(
      (row: { toStatus: string }) => row.toStatus === 'VERIFIED',
    ).length;
    expect(verifiedCount).toBe(1);
  });

  const rejectScenario = async () => {
    const created = await createRequest(requester, 'Reject Scenario Hospital').expect(201);
    await request(app)
      .post(`/api/v1/requests/${created.body.data.id}/reject`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Documentation does not match the blood bank.' })
      .expect(200);
    return created.body.data.id;
  };

  it('records a failed wallet transaction without changing the DB status', async () => {
    const rejectId = await rejectScenario();
    const operation = (
      await request(app)
        .get(`/api/v1/blockchain/operations?requestId=${rejectId}&status=PENDING`)
        .set('Authorization', bearer(hospital))
        .expect(200)
    ).body.data.items[0];

    chain.once((hash) => ({
      ok: false,
      reason: 'TX_REVERTED',
      message: 'Transaction reverted. The request database status was NOT changed.',
      retryable: false,
    }) as AnchorVerification);

    const confirm = await request(app)
      .post(`/api/v1/blockchain/operations/${operation.id}/confirm`)
      .set('Authorization', bearer(hospital))
      .send({ transactionHash: txHash('bb1') })
      .expect(200);
    expect(confirm.body.data.status).toBe('FAILED');
    expect(confirm.body.data.failure.reason).toBe('TX_REVERTED');
    expect(confirm.body.data.request.status).toBe('UNDER_REVIEW');

    const detail = await request(app)
      .get(`/api/v1/requests/${rejectId}`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(detail.body.data.status).toBe('UNDER_REVIEW');
    expect(detail.body.data.blockchainSyncStatus).toBe('FAILED');

    // The failed op cannot be confirmed again; a NEW decision can be prepared.
    const reconfirm = await request(app)
      .post(`/api/v1/blockchain/operations/${operation.id}/confirm`)
      .set('Authorization', bearer(hospital))
      .send({ transactionHash: txHash('bb1') })
      .expect(200);
    expect(reconfirm.body.data.failure.reason).toContain('TX_REVERTED');
  });

  it('verifies sender, recipient and events independently of the frontend', async () => {
    const created = await createRequest(requester, 'Mismatch Hospital').expect(201);
    const mismatchId = created.body.data.id;
    await request(app)
      .post(`/api/v1/requests/${mismatchId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Mismatch probe.' })
      .expect(200);
    const operation = (
      await request(app)
        .get(`/api/v1/blockchain/operations?requestId=${mismatchId}&status=PENDING`)
        .set('Authorization', bearer(hospital))
        .expect(200)
    ).body.data.items[0];

    // A receipt that does not match the caller's bound wallet must be rejected.
    chain.once((hash, expectation) => {
      void expectation;
      return {
        ok: false as const,
        reason: 'SENDER_MISMATCH' as const,
        message: 'The transaction was sent from another wallet.',
        retryable: false,
      };
    });
    const senderMismatch = await request(app)
      .post(`/api/v1/blockchain/operations/${operation.id}/confirm`)
      .set('Authorization', bearer(hospital))
      .send({ transactionHash: txHash('cc1') })
      .expect(200);
    expect(senderMismatch.body.data.status).toBe('FAILED');
    expect(senderMismatch.body.data.failure.reason).toBe('SENDER_MISMATCH');
  });

  it('keeps the operation open for reconciliation when the receipt is not found yet', async () => {
    const created = await createRequest(requester, 'Pending Hospital').expect(201);
    const pendingId = created.body.data.id;
    await request(app)
      .post(`/api/v1/requests/${pendingId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Pending probe.' })
      .expect(200);
    const operation = (
      await request(app)
        .get(`/api/v1/blockchain/operations?requestId=${pendingId}&status=PENDING`)
        .set('Authorization', bearer(hospital))
        .expect(200)
    ).body.data.items[0];

    chain.once(() => ({
      ok: false as const,
      reason: 'RECEIPT_NOT_FOUND' as const,
      message: 'The transaction is not on the chain yet.',
      retryable: true,
    }));
    const first = await request(app)
      .post(`/api/v1/blockchain/operations/${operation.id}/confirm`)
      .set('Authorization', bearer(hospital))
      .send({ transactionHash: txHash('dd1') })
      .expect(200);
    expect(first.body.data.status).toBe('PENDING_RECONCILIATION');

    // The decision stays pending, but the actual submitted hash is persisted
    // so a later retry can reconcile the same transaction safely.
    const detail = await request(app)
      .get(`/api/v1/requests/${pendingId}`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(detail.body.data.status).toBe('UNDER_REVIEW');
    expect(detail.body.data.blockchainSyncStatus).toBe('SUBMITTED');
    const submittedOperation = await db.query<{ transaction_status: string; transaction_hash: string }>(
      'select transaction_status, transaction_hash from public.blockchain_transactions where id = $1',
      [operation.id],
    );
    expect(submittedOperation.rows[0]?.transaction_status).toBe('SUBMITTED');
    expect(submittedOperation.rows[0]?.transaction_hash).toBe(txHash('dd1'));

    // Retrying the SAME hash (no new transaction!) is idempotent-safe and now
    // succeeds once the chain has the receipt.
    const retry = await request(app)
      .post(`/api/v1/blockchain/operations/${operation.id}/confirm`)
      .set('Authorization', bearer(hospital))
      .send({ transactionHash: txHash('dd1') })
      .expect(200);
    expect(retry.body.data.status).toBe('CONFIRMED');
    expect(retry.body.data.request.status).toBe('VERIFIED');
  });

  it('reconciles an operation whose chain truth arrived but whose DB update failed', async () => {
    const created = await createRequest(requester, 'Reconcile Hospital').expect(201);
    const reconcileId = created.body.data.id;
    await request(app)
      .post(`/api/v1/requests/${reconcileId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Reconcile probe.' })
      .expect(200);
    const operation = (
      await request(app)
        .get(`/api/v1/blockchain/operations?requestId=${reconcileId}&status=PENDING`)
        .set('Authorization', bearer(hospital))
        .expect(200)
    ).body.data.items[0];

    // Simulate a DB failure after chain success: the wallet transaction was
    // mined (hash recorded) but the database never moved out of the failure
    // state.
    const hash = txHash('ee1');
    await db.query(
      `update public.blockchain_transactions
          set transaction_status = 'NEEDS_RECONCILIATION',
              transaction_hash = $2,
              error_message = 'simulated crash after chain success'
        where id = $1`,
      [operation.id, hash],
    );
    await db.query(
      `update public.blood_requests set blockchain_sync_status = 'NEEDS_RECONCILIATION' where id = $1`,
      [reconcileId],
    );

    const reconciled = await request(app)
      .post(`/api/v1/blockchain/operations/${operation.id}/reconcile`)
      .set('Authorization', bearer(hospital))
      .expect(200);
    expect(reconciled.body.data.status).toBe('CONFIRMED');
    expect(reconciled.body.data.request.status).toBe('VERIFIED');
    expect(reconciled.body.data.request.blockchainSyncStatus).toBe('CONFIRMED');

    // The repair is reflected in the audit trail.
    const audit = await request(app)
      .get('/api/v1/admin/audit?eventType=BLOCKCHAIN_RECONCILE_CONFIRMED')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(audit.body.data.total).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------- completion
  it('funnels completion through the on-chain record in ON_CHAIN mode', async () => {
    // The requester cannot self-complete an on-chain request.
    await request(app)
      .post(`/api/v1/requests/${requestId}/complete`)
      .set('Authorization', bearer(requester))
      .send({ status: 'FULFILLED', note: 'Blood received.' })
      .expect(409);

    // A database-verified request can never be completed on chain.
    expect(chain.onChain.get(`0x${'none'}`)).toBeUndefined();

    const chainComplete = await request(app)
      .post(`/api/v1/requests/${requestId}/chain-complete`)
      .set('Authorization', bearer(hospital));
    expect(chainComplete.status).toBe(200);
    expect(chainComplete.body.data.mode).toBe('ON_CHAIN');
    const operation = chainComplete.body.data.operation;
    expect(operation.functionName).toBe('recordTerminalStatus');
    expect(operation.args).toEqual([
      `0x${operation.auditKey}`,
      '4',
    ]);
    expect(operation.expectedStatus).toBe('COMPLETED');

    const confirm = await request(app)
      .post(`/api/v1/blockchain/operations/${operation.operationId}/confirm`)
      .set('Authorization', bearer(hospital))
      .send({ transactionHash: txHash('ff1') })
      .expect(200);
    expect(confirm.body.data.status).toBe('CONFIRMED');
    expect(confirm.body.data.request.status).toBe('FULFILLED');
    expect(confirm.body.data.request.blockchainSyncStatus).toBe('CONFIRMED');
  });

  it('refuses completion anchors for requests that were never verified on chain', async () => {
    const created = await createRequest(requester, 'Db-Only Hospital').expect(201);
    const dbOnlyId = created.body.data.id;
    const response = await request(app)
      .post(`/api/v1/requests/${dbOnlyId}/chain-complete`)
      .set('Authorization', bearer(hospital))
      .expect(409);
    expect(response.body.error.message).toContain('no on-chain verification record');

    // Also blocked for an under-review request with an existing decision.
    await request(app)
      .post(`/api/v1/requests/${dbOnlyId}/reject`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Document mismatch for db-only request.' })
      .expect(200);
  });

  it('records on-chain rejections with the correct contract target', async () => {
    const created = await createRequest(requester, 'On-chain Reject Hospital').expect(201);
    const rejectId = created.body.data.id;
    const outcome = await request(app)
      .post(`/api/v1/requests/${rejectId}/reject`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Verified against donor registry: rejection on chain.' })
      .expect(200);
    expect(outcome.body.data.mode).toBe('ON_CHAIN');
    expect(outcome.body.data.operation.functionName).toBe('recordRejectedRequest');
    expect(outcome.body.data.operation.expectedStatus).toBe('REJECTED');

    const confirm = await request(app)
      .post(`/api/v1/blockchain/operations/${outcome.body.data.operation.operationId}/confirm`)
      .set('Authorization', bearer(hospital))
      .send({ transactionHash: txHash('cc2') })
      .expect(200);
    expect(confirm.body.data.status).toBe('CONFIRMED');
    expect(confirm.body.data.request.status).toBe('REJECTED');
    expect(confirm.body.data.request.blockchainSyncStatus).toBe('CONFIRMED');
  });

  it('exposes the audit dashboard with real operation data', async () => {
    const status = await request(app)
      .get('/api/v1/blockchain/status')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(status.body.data.verificationMode).toBe('ON_CHAIN');
    expect(status.body.data.chainHealth.connected).toBe(true);
    expect(status.body.data.contractAddress).toBe(CONTRACT_ADDRESS);
    expect(status.body.data.syncCounts.CONFIRMED).toBeGreaterThanOrEqual(1);
    expect(status.body.data.transactionsRecorded).toBeGreaterThan(0);
  });
});
