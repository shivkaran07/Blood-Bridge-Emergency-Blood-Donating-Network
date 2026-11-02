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

const NEEDED_BY = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

async function createRequest(app: Express, user: TestUser, overrides: Record<string, unknown> = {}) {
  const response = await request(app)
    .post('/api/v1/requests')
    .set('Authorization', bearer(user))
    .send({
      bloodGroup: 'O+',
      unitsRequested: 1,
      hospitalName: 'Sunrise Hospital',
      hospitalCity: 'Pune',
      hospitalArea: 'Kothrud',
      neededBy: NEEDED_BY,
      priority: 'URGENT',
      contactPhone: '+919876500000',
      contactShareConsent: true,
      accuracyConfirmed: true,
      latitude: 18.5074,
      longitude: 73.8077,
      ...overrides,
    })
    .expect(201);
  return response.body.data.id as string;
}

async function registerDonor(
  app: Express,
  user: TestUser,
  input: {
    bloodGroup: string;
    isAvailable: boolean;
    consentToContact: boolean;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
  },
) {
  await request(app)
    .put('/api/v1/donor/profile')
    .set('Authorization', bearer(user))
    .send({
      bloodGroup: input.bloodGroup,
      isAvailable: input.isAvailable,
      consentToContact: input.consentToContact,
      privacyAccepted: true,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    })
    .expect(200);
}

describe('matching, withdrawal and lifecycle edges', () => {
  let db: PgliteDb;
  let app: Express;
  let requester: TestUser;
  let hospital: TestUser;
  let matchingDonor: TestUser;
  let wrongGroupDonor: TestUser;
  let unavailableDonor: TestUser;
  let noConsentDonor: TestUser;

  beforeAll(async () => {
    db = await createTestDb();
    app = createTestApp(db);
    requester = await createUser(db, { email: 'req2@example.com', fullName: 'Rae Requester' });
    hospital = await createUser(db, { email: 'hosp2@example.com', fullName: 'Hana Hospital' });
    matchingDonor = await createUser(db, {
      email: 'match@example.com',
      fullName: 'Maya Match',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });
    wrongGroupDonor = await createUser(db, {
      email: 'wrong@example.com',
      fullName: 'Wes Wrong',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });
    unavailableDonor = await createUser(db, {
      email: 'unavailable@example.com',
      fullName: 'Una Unavailable',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });
    noConsentDonor = await createUser(db, {
      email: 'noconsent@example.com',
      fullName: 'Nora NoConsent',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });

    await registerDonor(app, matchingDonor, {
      bloodGroup: 'O+',
      isAvailable: true,
      consentToContact: true,
      latitude: 18.52,
      longitude: 73.85,
    });
    await registerDonor(app, wrongGroupDonor, {
      bloodGroup: 'A+',
      isAvailable: true,
      consentToContact: true,
    });
    await registerDonor(app, unavailableDonor, {
      bloodGroup: 'O+',
      isAvailable: false,
      consentToContact: true,
    });
    await registerDonor(app, noConsentDonor, {
      bloodGroup: 'O+',
      isAvailable: true,
      consentToContact: false,
    });

    // Approved hospital applicant
    const admin = await createUser(db, { email: 'admin3@example.com', roles: ['ADMIN'] });
    await request(app)
      .post('/api/v1/hospital/applications')
      .set('Authorization', bearer(hospital))
      .send({
        hospitalName: 'Sunrise Hospital',
        registrationNumber: 'MH-PUNE-9999',
        contactPerson: 'Dr Hana',
        contactPhone: '+912012345678',
        officialEmail: 'verify@sunrise.example',
        address: '12 Hospital Road, Pune',
        city: 'Pune',
        area: 'Kothrud',
        accuracyConfirmed: true,
      })
      .expect(201);
    const applicationId = (
      await request(app)
        .get('/api/v1/admin/hospital-applications?status=PENDING')
        .set('Authorization', bearer(admin))
        .expect(200)
    ).body.data.items[0].id;
    await request(app)
      .post(`/api/v1/admin/hospital-applications/${applicationId}/decision`)
      .set('Authorization', bearer(admin))
      .send({ decision: 'APPROVED' })
      .expect(200);
  });

  afterAll(async () => {
    await db.close();
  });

  it('matches by exact blood group, availability and consent, with masked identity', async () => {
    const requestId = await createRequest(app, requester, { neededBy: new Date(Date.now() + 86400000).toISOString() });
    await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Verified against hospital records.' })
      .expect(200);

    const matches = await request(app)
      .get(`/api/v1/requests/${requestId}/matches`)
      .set('Authorization', bearer(requester))
      .expect(200);

    expect(matches.body.data.bloodGroup).toBe('O+');
    expect(matches.body.data.totalCandidates).toBe(1);
    expect(matches.body.data.matches).toHaveLength(1);
    expect(matches.body.data.matches[0].displayName).toBe('Maya M.');
    expect(matches.body.data.matches[0].matchBasis).toBe('CITY_AND_AREA');
    expect(matches.body.data.matches[0].distanceKm).toBeGreaterThan(0);
    expect(JSON.stringify(matches.body.data)).not.toContain('+91');
    expect(JSON.stringify(matches.body.data)).not.toContain('latitude');
    expect(matches.body.data.matchingNotice).toContain('not a medical compatibility assessment');

    for (const ineligibleDonor of [noConsentDonor, unavailableDonor]) {
      const dashboard = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', bearer(ineligibleDonor))
        .expect(200);
      expect(dashboard.body.data.donor.availableRequests).toBe(0);
    }

    const privateDonorFeed = await request(app)
      .get('/api/v1/requests/feed?bloodGroup=O%2B')
      .set('Authorization', bearer(noConsentDonor))
      .expect(200);
    const privateDonorRequest = privateDonorFeed.body.data.items.find(
      (item: { id: string }) => item.id === requestId,
    );
    expect(privateDonorRequest.permissions.canRespond).toBe(false);

    await request(app)
      .post(`/api/v1/requests/${requestId}/respond`)
      .set('Authorization', bearer(noConsentDonor))
      .expect(403);

    // A stranger cannot see donor matches for someone else's request.
    await request(app)
      .get(`/api/v1/requests/${requestId}/matches`)
      .set('Authorization', bearer(wrongGroupDonor))
      .expect(404);
  });

  it('allows withdrawal, then a new offer, and rejects stale decisions', async () => {
    const requestId = await createRequest(app, requester, {
      hospitalName: 'Withdrawal Hospital',
      neededBy: new Date(Date.now() + 86400000).toISOString(),
    });

    await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Verified for withdrawal test.' })
      .expect(200);

    const first = await request(app)
      .post(`/api/v1/requests/${requestId}/respond`)
      .set('Authorization', bearer(matchingDonor))
      .expect(201);

    await request(app)
      .post(`/api/v1/responses/${first.body.data.id}/withdraw`)
      .set('Authorization', bearer(matchingDonor))
      .expect(200);

    // A withdrawn donor becomes eligible to offer again, so they reappear in
    // the matching pool but have no active response.
    const afterWithdrawal = await request(app)
      .get(`/api/v1/requests/${requestId}/matches`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(afterWithdrawal.body.data.matches).toHaveLength(1);

    const second = await request(app)
      .post(`/api/v1/requests/${requestId}/respond`)
      .set('Authorization', bearer(matchingDonor))
      .expect(201);

    const decline = await request(app)
      .post(`/api/v1/responses/${second.body.data.id}/decision`)
      .set('Authorization', bearer(requester))
      .send({ decision: 'DECLINED' })
      .expect(200);
    expect(decline.body.data.responseStatus).toBe('DECLINED');

    // A declined response is final.
    await request(app)
      .post(`/api/v1/responses/${second.body.data.id}/decision`)
      .set('Authorization', bearer(requester))
      .send({ decision: 'ACCEPTED' })
      .expect(409);
  });

  it('expires a verified request after its required-by time and closes offers', async () => {
    const requestId = await createRequest(app, requester, {
      bloodGroup: 'A-',
      hospitalName: 'Expiry Hospital',
      neededBy: new Date(Date.now() + 86400000).toISOString(),
    });
    await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Verifying expiry test request.' })
      .expect(200);

    await db.query("update public.blood_requests set needed_by = now() - interval '1 minute' where id = $1", [requestId]);

    const detail = await request(app)
      .get(`/api/v1/requests/${requestId}`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(detail.body.data.status).toBe('EXPIRED');

    await request(app)
      .post(`/api/v1/responses/${crypto.randomUUID()}/decision`)
      .set('Authorization', bearer(requester))
      .send({ decision: 'ACCEPTED' })
      .expect(404);
  });

  it('cancels a request and prevents later verification', async () => {
    const requestId = await createRequest(app, requester, {
      bloodGroup: 'B-',
      hospitalName: 'Cancel Hospital',
      neededBy: new Date(Date.now() + 86400000).toISOString(),
    });

    const cancelled = await request(app)
      .post(`/api/v1/requests/${requestId}/cancel`)
      .set('Authorization', bearer(requester))
      .send({ reason: 'Blood was arranged through another hospital.' })
      .expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    await request(app)
      .post(`/api/v1/requests/${requestId}/cancel`)
      .set('Authorization', bearer(requester))
      .send({ reason: 'Trying to cancel twice.' })
      .expect(409);

    await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Trying to verify a cancelled request.' })
      .expect(409);
  });

  it('validates rejection reasons and records a rejection', async () => {
    const requestId = await createRequest(app, requester, {
      bloodGroup: 'AB+',
      hospitalName: 'Reject Hospital',
      neededBy: new Date(Date.now() + 86400000).toISOString(),
    });

    await request(app)
      .post(`/api/v1/requests/${requestId}/reject`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'too short' })
      .expect(422);

    const rejected = await request(app)
      .post(`/api/v1/requests/${requestId}/reject`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'The hospital could not confirm this request with the requester.' })
      .expect(200);
    expect(rejected.body.data.status).toBe('REJECTED');
  });
});
