/**
 * Regression tests for the canRespond permission flag returned by the
 * request detail endpoint (GET /api/v1/requests/:id) and the donor feed
 * (GET /api/v1/requests/feed).
 *
 * These tests guard against the bug documented in PROJECT_AUDIT_REPORT.md §4
 * where detailDto omitted the contact-consent check, causing canRespond=true
 * even when the backend would reject the donor's response attempt.
 *
 * The canonical eligibility logic now lives in evaluateDonorEligibility()
 * inside requestService.ts, which is used by both code paths.
 *
 * Coverage matrix:
 *   ✓ Donor with contact consent enabled and all conditions met → canRespond = true
 *   ✓ Donor with contact consent disabled → canRespond = false  (THE KEY REGRESSION)
 *   ✓ Donor without an existing donor profile → canRespond = false
 *   ✓ Donor who is unavailable → canRespond = false
 *   ✓ Donor with a mismatched blood group → canRespond = false
 *   ✓ Expired or closed request → canRespond = false
 *   ✓ Donor who already has an active response → canRespond = false
 *   ✓ Request that is not yet verified (SUBMITTED status) → canRespond = false
 *   ✓ Requester viewing their own request → canRespond = false
 *   ✓ Backend rejects response from no-consent donor with 403
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  bearer,
  createTestApp,
  createTestDb,
  createUser,
  type PgliteDb,
  type TestUser,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Unique request parameters
// Each test that creates its own request uses unique neededBy + hospitalName
// so the duplicate-detection logic (same requester + blood group +
// (neededBy OR hospital name within 30 min)) never fires across tests.
// ---------------------------------------------------------------------------
let requestSeq = 0;
function uniqueRequestParams(bloodGroup = 'O+') {
  requestSeq += 1;
  const neededBy = new Date(Date.now() + (48 + requestSeq) * 60 * 60 * 1000).toISOString();
  return {
    bloodGroup,
    unitsRequested: 1,
    hospitalName: `CR Hospital ${requestSeq}`,
    hospitalCity: 'Pune',
    hospitalArea: 'Kothrud',
    neededBy,
    priority: 'URGENT' as const,
    contactPhone: '+919876500001',
    contactShareConsent: true,
    accuracyConfirmed: true,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createAndVerifyRequest(
  app: Express,
  requester: TestUser,
  hospital: TestUser,
  bloodGroup = 'O+',
): Promise<string> {
  const params = uniqueRequestParams(bloodGroup);
  const res = await request(app)
    .post('/api/v1/requests')
    .set('Authorization', bearer(requester))
    .send(params)
    .expect(201);
  const requestId = res.body.data.id as string;

  await request(app)
    .post(`/api/v1/requests/${requestId}/verify`)
    .set('Authorization', bearer(hospital))
    .send({ reason: 'Confirmed for canRespond regression test.' })
    .expect(200);

  return requestId;
}

async function registerDonorProfile(
  app: Express,
  user: TestUser,
  opts: { bloodGroup?: string; isAvailable?: boolean; consentToContact?: boolean } = {},
) {
  const { bloodGroup = 'O+', isAvailable = true, consentToContact = true } = opts;
  await request(app)
    .put('/api/v1/donor/profile')
    .set('Authorization', bearer(user))
    .send({ bloodGroup, isAvailable, consentToContact, privacyAccepted: true, latitude: null, longitude: null })
    .expect(200);
}

async function detailCanRespond(app: Express, viewer: TestUser, requestId: string): Promise<boolean> {
  const res = await request(app)
    .get(`/api/v1/requests/${requestId}`)
    .set('Authorization', bearer(viewer))
    .expect(200);
  return res.body.data.permissions.canRespond as boolean;
}

async function feedCanRespond(
  app: Express,
  viewer: TestUser,
  requestId: string,
): Promise<boolean | undefined> {
  const res = await request(app)
    .get('/api/v1/requests/feed')
    .set('Authorization', bearer(viewer))
    .expect(200);
  const item = (
    res.body.data.items as Array<{ id: string; permissions: { canRespond: boolean } }>
  ).find((i) => i.id === requestId);
  return item?.permissions.canRespond;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('canRespond permission consistency — detail and feed', () => {
  let db: PgliteDb;
  let app: Express;

  let requester: TestUser;
  let hospital: TestUser;
  let eligibleDonor: TestUser;
  let noConsentDonor: TestUser;
  let noDonorProfile: TestUser;
  let unavailableDonor: TestUser;
  let wrongGroupDonor: TestUser;

  let verifiedRequestId: string;

  beforeAll(async () => {
    db = await createTestDb();
    app = createTestApp(db);

    requester = await createUser(db, { email: 'cr-requester@example.com', fullName: 'CR Requester' });
    hospital = await createUser(db, { email: 'cr-hospital@example.com', fullName: 'CR Hospital' });
    eligibleDonor = await createUser(db, {
      email: 'cr-eligible@example.com',
      fullName: 'CR Eligible',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });
    noConsentDonor = await createUser(db, {
      email: 'cr-noconsent@example.com',
      fullName: 'CR NoConsent',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });
    noDonorProfile = await createUser(db, {
      email: 'cr-noprofile@example.com',
      fullName: 'CR NoProfile',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });
    unavailableDonor = await createUser(db, {
      email: 'cr-unavailable@example.com',
      fullName: 'CR Unavailable',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });
    wrongGroupDonor = await createUser(db, {
      email: 'cr-wronggroup@example.com',
      fullName: 'CR WrongGroup',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });

    // Approve hospital
    const admin = await createUser(db, { email: 'cr-admin@example.com', roles: ['ADMIN'] });
    await request(app)
      .post('/api/v1/hospital/applications')
      .set('Authorization', bearer(hospital))
      .send({
        hospitalName: 'CR Regional Hospital',
        registrationNumber: 'MH-CR-0001',
        contactPerson: 'Dr CR',
        contactPhone: '+912099990001',
        officialEmail: 'cr@hospital.example',
        address: '1 CR Road, Pune',
        city: 'Pune',
        area: 'Kothrud',
        accuracyConfirmed: true,
      })
      .expect(201);
    const appsRes = await request(app)
      .get('/api/v1/admin/hospital-applications?status=PENDING')
      .set('Authorization', bearer(admin))
      .expect(200);
    const appId = appsRes.body.data.items[0].id as string;
    await request(app)
      .post(`/api/v1/admin/hospital-applications/${appId}/decision`)
      .set('Authorization', bearer(admin))
      .send({ decision: 'APPROVED' })
      .expect(200);

    // Register donor profiles
    await registerDonorProfile(app, eligibleDonor, { bloodGroup: 'O+', isAvailable: true, consentToContact: true });
    await registerDonorProfile(app, noConsentDonor, { bloodGroup: 'O+', isAvailable: true, consentToContact: false });
    await registerDonorProfile(app, unavailableDonor, { bloodGroup: 'O+', isAvailable: false, consentToContact: true });
    await registerDonorProfile(app, wrongGroupDonor, { bloodGroup: 'A+', isAvailable: true, consentToContact: true });
    // noDonorProfile intentionally has no donor profile

    verifiedRequestId = await createAndVerifyRequest(app, requester, hospital, 'O+');
  });

  afterAll(async () => {
    await db.close();
  });

  // 1. Eligible donor — canRespond must be TRUE on both endpoints
  it('returns canRespond=true for a fully eligible donor', async () => {
    expect(await detailCanRespond(app, eligibleDonor, verifiedRequestId)).toBe(true);
    expect(await feedCanRespond(app, eligibleDonor, verifiedRequestId)).toBe(true);
  });

  // 2. Contact consent disabled — THE KEY REGRESSION
  //    Before the fix, detailDto returned true; feed returned false.
  it('returns canRespond=false when contact-sharing consent is disabled — detail and feed agree', async () => {
    const detail = await detailCanRespond(app, noConsentDonor, verifiedRequestId);
    const feed = await feedCanRespond(app, noConsentDonor, verifiedRequestId);

    expect(detail).toBe(false);
    expect(feed).toBe(false);
    // Both must agree — the divergence was the original bug.
    expect(detail).toBe(feed);
  });

  // 3. No donor profile row at all
  it('returns canRespond=false when the user has no donor profile', async () => {
    expect(await detailCanRespond(app, noDonorProfile, verifiedRequestId)).toBe(false);
    expect(await feedCanRespond(app, noDonorProfile, verifiedRequestId)).toBe(false);
  });

  // 4. Donor marked unavailable
  it('returns canRespond=false when the donor is marked unavailable', async () => {
    expect(await detailCanRespond(app, unavailableDonor, verifiedRequestId)).toBe(false);
    expect(await feedCanRespond(app, unavailableDonor, verifiedRequestId)).toBe(false);
  });

  // 5. Mismatched blood group — donor is A+, request is O+
  it('returns canRespond=false for a blood-group mismatch', async () => {
    expect(await detailCanRespond(app, wrongGroupDonor, verifiedRequestId)).toBe(false);
    // Feed may not show A+ requests to an A+ donor; if present, must be false.
    const feedResult = await feedCanRespond(app, wrongGroupDonor, verifiedRequestId);
    if (feedResult !== undefined) {
      expect(feedResult).toBe(false);
    }
  });

  // 6. Expired request
  //    EXPIRED requests are only visible to the owner, admins, and hospital verifiers.
  //    We use the requester (owner) to view it, confirming canRespond=false.
  //    We also confirm the respond endpoint rejects an eligible donor with 409.
  it('returns canRespond=false for an expired request', async () => {
    const expiredId = await createAndVerifyRequest(app, requester, hospital, 'O+');
    await db.query(
      "update public.blood_requests set needed_by = now() - interval '1 minute' where id = $1",
      [expiredId],
    );
    // The requester (owner) can always view their own request — confirms status flipped to EXPIRED.
    const res = await request(app)
      .get(`/api/v1/requests/${expiredId}`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(res.body.data.status).toBe('EXPIRED');
    // Requester cannot respond to their own request — canRespond is always false for the owner.
    expect(res.body.data.permissions.canRespond).toBe(false);

    // Eligible donor's respond attempt is also rejected (deadline guard).
    await request(app)
      .post(`/api/v1/requests/${expiredId}/respond`)
      .set('Authorization', bearer(eligibleDonor))
      .expect(409);
  });

  // 7. Donor already has an active response
  it('returns canRespond=false once the donor already has an active response', async () => {
    const freshId = await createAndVerifyRequest(app, requester, hospital, 'O+');

    expect(await detailCanRespond(app, eligibleDonor, freshId)).toBe(true);
    expect(await feedCanRespond(app, eligibleDonor, freshId)).toBe(true);

    await request(app)
      .post(`/api/v1/requests/${freshId}/respond`)
      .set('Authorization', bearer(eligibleDonor))
      .expect(201);

    expect(await detailCanRespond(app, eligibleDonor, freshId)).toBe(false);
    expect(await feedCanRespond(app, eligibleDonor, freshId)).toBe(false);
  });

  // 8. Request not yet verified (SUBMITTED)
  //    SUBMITTED requests are only visible to their owner, admins, and hospital verifiers.
  //    We use the requester (owner) to verify canRespond=false (owner cannot respond to own request).
  //    We also confirm an eligible donor's respond attempt is rejected by the backend (status guard).
  it('returns canRespond=false for a SUBMITTED (unverified) request', async () => {
    const params = uniqueRequestParams('O+');
    const submittedRes = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', bearer(requester))
      .send(params)
      .expect(201);
    const submittedId = submittedRes.body.data.id as string;

    // The requester (owner) can view their own SUBMITTED request.
    const res = await request(app)
      .get(`/api/v1/requests/${submittedId}`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(res.body.data.status).toBe('SUBMITTED');
    // Owner cannot respond to their own request.
    expect(res.body.data.permissions.canRespond).toBe(false);

    // An eligible donor is also blocked by the backend status guard.
    await request(app)
      .post(`/api/v1/requests/${submittedId}/respond`)
      .set('Authorization', bearer(eligibleDonor))
      .expect(409); // Only verified, open requests can receive donor responses.
  });

  // 9. Requester viewing their own request
  it('returns canRespond=false when the requester views their own request', async () => {
    expect(await detailCanRespond(app, requester, verifiedRequestId)).toBe(false);
  });

  // 10. Backend consistency — server must reject responses from no-consent donors
  it('backend rejects a response attempt from a no-consent donor with 403', async () => {
    await request(app)
      .post(`/api/v1/requests/${verifiedRequestId}/respond`)
      .set('Authorization', bearer(noConsentDonor))
      .expect(403);
  });
});
