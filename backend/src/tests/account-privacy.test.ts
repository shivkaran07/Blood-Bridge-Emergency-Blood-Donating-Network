import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  bearer,
  createTestApp,
  createTestDb,
  createUser,
  registerTestToken,
  type PgliteDb,
  type TestUser,
} from './helpers.js';
import { ServiceUnavailableError } from '../lib/errors.js';

describe('self-service account anonymization', () => {
  let db: PgliteDb;
  let app: Express;
  let requester: TestUser;
  let donor: TestUser;
  const identityAdmin = {
    anonymizeUser: vi.fn()
      .mockRejectedValueOnce(new ServiceUnavailableError())
      .mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    db = await createTestDb();
    app = createTestApp(db, undefined, undefined, identityAdmin);
    requester = await createUser(db, {
      email: 'privacy-requester@example.com',
      fullName: 'Private Requester',
    });
    donor = await createUser(db, {
      email: 'privacy-donor@example.com',
      fullName: 'Donor Participant',
    });
  });

  afterAll(async () => {
    await db.close();
  });

  it('requires a recently reauthenticated Supabase session', async () => {
    const user = await createUser(db, { email: 'stale-session@example.test' });
    const staleToken = registerTestToken({
      id: user.id,
      email: user.email,
      emailConfirmedAt: new Date().toISOString(),
      authTime: Math.floor(Date.now() / 1000) - 600,
    });

    await request(app)
      .delete('/api/v1/me')
      .set('Authorization', bearer({ ...user, token: staleToken }))
      .send({ confirmation: 'DELETE' })
      .expect(401);

    const status = await db.query<{ account_status: string }>(
      'select account_status from public.profiles where id = $1',
      [user.id],
    );
    expect(status.rows[0]?.account_status).toBe('ACTIVE');
  });

  it('cancels active requests, scrubs direct details, and allows retrying Auth disablement', async () => {
    const created = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', bearer(requester))
      .send({
        bloodGroup: 'O+',
        unitsRequested: 1,
        hospitalName: 'Sunrise Hospital',
        hospitalCity: 'Pune',
        hospitalArea: 'Kothrud',
        neededBy: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        priority: 'URGENT',
        publicMessage: 'Patient details that should be removed',
        contactPhone: '+919876500000',
        contactShareConsent: true,
        accuracyConfirmed: true,
        latitude: 18.5074,
        longitude: 73.8077,
      })
      .expect(201);
    const requestId = created.body.data.id as string;
    await db.query(
      `insert into public.donor_responses (request_id, donor_id, response_status)
       values ($1, $2, 'OFFERED')`,
      [requestId, donor.id],
    );

    await request(app)
      .delete('/api/v1/me')
      .set('Authorization', bearer(requester))
      .send({ confirmation: 'DELETE' })
      .expect(503);

    const profileAfterFirstAttempt = await db.query<{
      full_name: string;
      phone_number: string | null;
      account_status: string;
    }>('select full_name, phone_number, account_status from public.profiles where id = $1', [
      requester.id,
    ]);
    expect(profileAfterFirstAttempt.rows[0]).toEqual({
      full_name: 'Deleted account',
      phone_number: null,
      account_status: 'SUSPENDED',
    });

    await request(app)
      .delete('/api/v1/me')
      .set('Authorization', bearer(requester))
      .send({ confirmation: 'DELETE' })
      .expect(200, {
        data: { status: 'ANONYMIZED', requestHistoryRetained: true },
      });

    const anonymizedRequest = await db.query<{
      status: string;
      requester_contact_phone: string | null;
      public_message: string | null;
      hospital_latitude: number | null;
      hospital_longitude: number | null;
      contact_share_consent: boolean;
    }>(
      `select status, requester_contact_phone, public_message, hospital_latitude,
              hospital_longitude, contact_share_consent
         from public.blood_requests where id = $1`,
      [requestId],
    );
    expect(anonymizedRequest.rows[0]).toMatchObject({
      status: 'CANCELLED',
      requester_contact_phone: null,
      public_message: null,
      hospital_latitude: null,
      hospital_longitude: null,
      contact_share_consent: false,
    });

    const responseStatus = await db.query<{ response_status: string }>(
      'select response_status from public.donor_responses where request_id = $1',
      [requestId],
    );
    expect(responseStatus.rows[0]?.response_status).toBe('CANCELLED');
    expect(identityAdmin.anonymizeUser).toHaveBeenCalledTimes(2);
  });

  it('rejects closure by the last administrator', async () => {
    const admin = await createUser(db, {
      email: 'last-admin@example.com',
      fullName: 'Last Admin',
      roles: ['ADMIN'],
    });

    await request(app)
      .delete('/api/v1/me')
      .set('Authorization', bearer(admin))
      .send({ confirmation: 'DELETE' })
      .expect(409);

    const status = await db.query<{ account_status: string }>(
      'select account_status from public.profiles where id = $1',
      [admin.id],
    );
    expect(status.rows[0]?.account_status).toBe('ACTIVE');
  });
});
