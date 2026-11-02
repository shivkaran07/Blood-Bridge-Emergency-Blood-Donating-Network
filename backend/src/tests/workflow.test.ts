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

describe('full blood request lifecycle', () => {
  let db: PgliteDb;
  let app: Express;
  let requester: TestUser;
  let donor: TestUser;
  let secondDonor: TestUser;
  let hospital: TestUser;
  let admin: TestUser;
  let requestId: string;
  let responseId: string;

  beforeAll(async () => {
    db = await createTestDb();
    app = createTestApp(db);

    requester = await createUser(db, { email: 'requester@example.com', fullName: 'Riya Requester' });
    donor = await createUser(db, {
      email: 'donor@example.com',
      fullName: 'Dev Donor',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });
    secondDonor = await createUser(db, {
      email: 'donor2@example.com',
      fullName: 'Sam Second',
      roles: ['DONOR'],
      accountType: 'DONOR',
    });
    hospital = await createUser(db, {
      email: 'hospital@example.com',
      fullName: 'Hema Hospital',
    });
    admin = await createUser(db, {
      email: 'admin@example.com',
      fullName: 'Ari Admin',
      roles: ['ADMIN'],
    });

    await request(app)
      .patch('/api/v1/me')
      .set('Authorization', bearer(donor))
      .send({
        fullName: 'Dev Donor',
        phoneNumber: '+919876543210',
        city: 'Pune',
        area: 'Kothrud',
      })
      .expect(200);

    await request(app)
      .put('/api/v1/donor/profile')
      .set('Authorization', bearer(donor))
      .send({
        bloodGroup: 'O+',
        isAvailable: true,
        consentToContact: true,
        privacyAccepted: true,
        latitude: 18.5074,
        longitude: 73.8077,
      })
      .expect(200);

    await request(app)
      .put('/api/v1/donor/profile')
      .set('Authorization', bearer(secondDonor))
      .send({
        bloodGroup: 'A+',
        isAvailable: true,
        consentToContact: false,
        privacyAccepted: true,
      })
      .expect(200);
  });

  it('creates a neutral donor profile and preserves saved preferences on availability changes', async () => {
    const neutralDonor = await createUser(db, {
      email: 'neutral-donor@example.com',
      fullName: 'Nina Neutral',
    });

    const created = await request(app)
      .put('/api/v1/donor/profile')
      .set('Authorization', bearer(neutralDonor))
      .send({
        bloodGroup: 'AB-',
        isAvailable: false,
        consentToContact: false,
        privacyAccepted: true,
      })
      .expect(200);

    // No server default may silently enrol a new donor as available, O+ or
    // contact-consenting. The values sent by the explicit onboarding form win.
    expect(created.body.data).toMatchObject({
      bloodGroup: 'AB-',
      isAvailable: false,
      consentToContact: false,
      latitude: null,
      longitude: null,
    });

    const loaded = await request(app)
      .get('/api/v1/me')
      .set('Authorization', bearer(neutralDonor))
      .expect(200);
    expect(loaded.body.data.donorProfile).toMatchObject({
      bloodGroup: 'AB-',
      isAvailable: false,
      consentToContact: false,
    });

    const resumed = await request(app)
      .patch('/api/v1/donor/availability')
      .set('Authorization', bearer(neutralDonor))
      .send({ isAvailable: true })
      .expect(200);

    // Availability is a separate control: changing it must not turn on
    // contact sharing or invent coordinates.
    expect(resumed.body.data).toMatchObject({
      bloodGroup: 'AB-',
      isAvailable: true,
      consentToContact: false,
      latitude: null,
      longitude: null,
    });
  });

  it('requires explicit privacy acceptance before creating a donor profile', async () => {
    const unconsentedDonor = await createUser(db, {
      email: 'unconsented-donor@example.com',
      fullName: 'Uma Unconsented',
    });

    await request(app)
      .put('/api/v1/donor/profile')
      .set('Authorization', bearer(unconsentedDonor))
      .send({
        bloodGroup: 'O-',
        isAvailable: true,
        consentToContact: true,
        privacyAccepted: false,
      })
      .expect(422);
  });

  it('stores opted-in approximate location independently of contact-sharing consent', async () => {
    const privateLocationDonor = await createUser(db, {
      email: 'private-location-donor@example.com',
      fullName: 'Luca Location',
    });

    const saved = await request(app)
      .put('/api/v1/donor/profile')
      .set('Authorization', bearer(privateLocationDonor))
      .send({
        bloodGroup: 'B+',
        isAvailable: false,
        consentToContact: false,
        privacyAccepted: true,
        latitude: 18.5,
        longitude: 73.8,
      })
      .expect(200);

    expect(saved.body.data).toMatchObject({
      bloodGroup: 'B+',
      isAvailable: false,
      consentToContact: false,
      latitude: 18.5,
      longitude: 73.8,
    });

    const loaded = await request(app)
      .get('/api/v1/me')
      .set('Authorization', bearer(privateLocationDonor))
      .expect(200);
    expect(loaded.body.data.donorProfile).toMatchObject({
      consentToContact: false,
      latitude: 18.5,
      longitude: 73.8,
    });
  });

  afterAll(async () => {
    await db.close();
  });

  it('creates a request as SUBMITTED and keeps it out of the donor feed', async () => {
    const response = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', bearer(requester))
      .send({
        bloodGroup: 'O+',
        unitsRequested: 2,
        hospitalName: 'Sunrise Hospital',
        hospitalCity: 'Pune',
        hospitalArea: 'Kothrud',
        neededBy: NEEDED_BY,
        priority: 'URGENT',
        publicMessage: 'Urgent need after surgery.',
        contactPhone: '+919876543210',
        contactShareConsent: true,
        accuracyConfirmed: true,
        latitude: 18.5074,
        longitude: 73.8077,
      })
      .expect(201);

    requestId = response.body.data.id;
    expect(response.body.data.status).toBe('SUBMITTED');
    expect(response.body.data.verification.mode).toBe('DATABASE');
    expect(response.body.data.verification.transactionCount).toBe(0);
    expect(response.body.data.blockchainAuditKey).toMatch(/^[a-f0-9]{64}$/);

    const feed = await request(app)
      .get('/api/v1/requests/feed')
      .set('Authorization', bearer(donor))
      .expect(200);
    expect(feed.body.data.items).toHaveLength(0);

    const duplicate = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', bearer(requester))
      .send({
        bloodGroup: 'O+',
        unitsRequested: 1,
        hospitalName: 'Sunrise Hospital',
        hospitalCity: 'Pune',
        hospitalArea: 'Kothrud',
        neededBy: NEEDED_BY,
        priority: 'NORMAL',
        contactPhone: '+919876543210',
        contactShareConsent: true,
        accuracyConfirmed: true,
      })
      .expect(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('lets a hospital apply, and only an administrator can approve it', async () => {
    await request(app)
      .post('/api/v1/hospital/applications')
      .set('Authorization', bearer(hospital))
      .send({
        hospitalName: 'Sunrise Hospital',
        registrationNumber: 'MH-PUNE-1234',
        contactPerson: 'Dr Hema',
        contactPhone: '+912012345678',
        officialEmail: 'verify@sunrise.example',
        address: '12 Hospital Road, Pune',
        city: 'Pune',
        area: 'Kothrud',
        accuracyConfirmed: true,
      })
      .expect(201);

    const pending = await request(app)
      .get('/api/v1/admin/hospital-applications?status=PENDING')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(pending.body.data.total).toBe(1);
    const applicationId = pending.body.data.items[0].id;

    // A hospital applicant cannot approve itself.
    await request(app)
      .post(`/api/v1/admin/hospital-applications/${applicationId}/decision`)
      .set('Authorization', bearer(hospital))
      .send({ decision: 'APPROVED' })
      .expect(403);

    await request(app)
      .post(`/api/v1/admin/hospital-applications/${applicationId}/decision`)
      .set('Authorization', bearer(admin))
      .send({ decision: 'APPROVED' })
      .expect(200);

    const me = await request(app)
      .get('/api/v1/me')
      .set('Authorization', bearer(hospital))
      .expect(200);
    expect(me.body.data.roles).toContain('HOSPITAL');
    expect(me.body.data.permissions.isApprovedVerifier).toBe(true);
  });

  it('allows an approved hospital to verify, but not the requester or a donor', async () => {
    await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(donor))
      .send({ reason: 'Looks fine' })
      .expect(403);

    const verified = await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(hospital))
      .send({ reason: 'Confirmed with the hospital blood bank.' })
      .expect(200);

    expect(verified.body.data.status).toBe('VERIFIED');
    expect(verified.body.data.reviewReason).toBe('Confirmed with the hospital blood bank.');

    const history = await request(app)
      .get(`/api/v1/requests/${requestId}/history`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(history.body.data.map((row: { toStatus: string }) => row.toStatus)).toEqual([
      'SUBMITTED',
      'UNDER_REVIEW',
      'VERIFIED',
    ]);
  });

  it('surfaces verified requests to matching donors without leaking contact details', async () => {
    const feed = await request(app)
      .get('/api/v1/requests/feed')
      .set('Authorization', bearer(donor))
      .expect(200);
    expect(feed.body.data.items).toHaveLength(1);
    expect(feed.body.data.items[0].id).toBe(requestId);
    expect(feed.body.data.items[0].requesterContactPhone).toBeNull();
    expect(feed.body.data.items[0].blockchainAuditKey).toBeNull();

    const mismatched = await request(app)
      .get('/api/v1/requests/feed')
      .set('Authorization', bearer(secondDonor))
      .expect(200);
    expect(mismatched.body.data.items).toHaveLength(0);
  });

  it('prevents duplicate active responses and reveals contact only after acceptance', async () => {
    const created = await request(app)
      .post(`/api/v1/requests/${requestId}/respond`)
      .set('Authorization', bearer(donor))
      .expect(201);
    responseId = created.body.data.id;
    expect(created.body.data.responseStatus).toBe('OFFERED');
    expect(created.body.data.donorPhone).toBeNull();

    await request(app)
      .post(`/api/v1/requests/${requestId}/respond`)
      .set('Authorization', bearer(donor))
      .expect(409);

    const offers = await request(app)
      .get(`/api/v1/requests/${requestId}/responses`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(offers.body.data).toHaveLength(1);
    expect(offers.body.data[0].donorPhone).toBeNull();
    expect(offers.body.data[0].contactShared).toBe(false);

    // The requester cannot accept their own response, and another donor cannot decide.
    await request(app)
      .post(`/api/v1/responses/${responseId}/decision`)
      .set('Authorization', bearer(secondDonor))
      .send({ decision: 'ACCEPTED' })
      .expect(403);

    await request(app)
      .post(`/api/v1/responses/${responseId}/decision`)
      .set('Authorization', bearer(requester))
      .send({ decision: 'ACCEPTED' })
      .expect(200);

    const acceptedOffers = await request(app)
      .get(`/api/v1/requests/${requestId}/responses`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(acceptedOffers.body.data[0].responseStatus).toBe('ACCEPTED');
    expect(acceptedOffers.body.data[0].donorPhone).toBe('+919876543210');
    expect(acceptedOffers.body.data[0].contactShared).toBe(true);

    // The accepted donor now sees the requester's shared contact number.
    const detail = await request(app)
      .get(`/api/v1/requests/${requestId}`)
      .set('Authorization', bearer(donor))
      .expect(200);
    expect(detail.body.data.requesterContactPhone).toBe('+919876543210');
  });

  it('records completion without claiming medical proof', async () => {
    await request(app)
      .post(`/api/v1/responses/${responseId}/complete`)
      .set('Authorization', bearer(secondDonor))
      .expect(403);

    const completed = await request(app)
      .post(`/api/v1/requests/${requestId}/complete`)
      .set('Authorization', bearer(requester))
      .send({ status: 'FULFILLED', note: 'Blood received through hospital protocol.' })
      .expect(200);
    expect(completed.body.data.status).toBe('FULFILLED');

    const audit = await request(app)
      .get('/api/v1/admin/audit?eventType=REQUEST_FULFILLED')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(audit.body.data.total).toBeGreaterThanOrEqual(1);
    expect(audit.body.data.items[0].metadata.medicalProof).toBeUndefined();
  });

  it('exposes a truthful blockchain status and audit reference', async () => {
    const status = await request(app)
      .get('/api/v1/blockchain/status')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(status.body.data.connected).toBe(false);
    expect(status.body.data.operational).toBe(false);
    expect(status.body.data.transactionsRecorded).toBe(0);
    expect(status.body.data.verificationMode).toBe('DATABASE');

    const record = await request(app)
      .get(`/api/v1/requests/${requestId}/blockchain`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(record.body.data.blockchainAuditKey).toMatch(/^[a-f0-9]{64}$/);
    expect(record.body.data.transactions).toHaveLength(0);
    // Truthful copy: this deployment is database-backed; nothing was anchored.
    expect(record.body.data.blockchainVerified).toBe(false);
    expect(record.body.data.note).toContain('Database verification never creates an anchor');
  });

  it('delivers notifications and lets recipients mark them read', async () => {
    const list = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(list.body.data.items.length).toBeGreaterThan(0);
    const notificationId = list.body.data.items[0].id;

    const updated = await request(app)
      .post(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(updated.body.data.readAt).toBeTruthy();

    // Another user cannot mark someone else's notification.
    await request(app)
      .post(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', bearer(donor))
      .expect(404);
  });

  it('shows role-aware dashboard sections', async () => {
    const requesterDashboard = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', bearer(requester))
      .expect(200);
    expect(requesterDashboard.body.data.requester.summary.total).toBe(1);

    const hospitalDashboard = await request(app)
      .get('/api/v1/hospital/dashboard')
      .set('Authorization', bearer(hospital))
      .expect(200);
    expect(hospitalDashboard.body.data.verifiedByMe).toBeGreaterThanOrEqual(1);
  });
});
