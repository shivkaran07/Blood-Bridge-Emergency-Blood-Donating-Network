import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  asRole,
  bearer,
  createTestApp,
  createTestDb,
  createUser,
  type PgliteDb,
  type TestUser,
} from './helpers.js';

const NEEDED_BY = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe('authorization, role safety and RLS', () => {
  let db: PgliteDb;
  let app: Express;
  let owner: TestUser;
  let stranger: TestUser;
  let unapprovedHospital: TestUser;
  let admin: TestUser;
  let admin2: TestUser;
  let requestId: string;

  beforeAll(async () => {
    db = await createTestDb();
    app = createTestApp(db);
    owner = await createUser(db, { email: 'owner@example.com', fullName: 'Olive Owner' });
    stranger = await createUser(db, { email: 'stranger@example.com', fullName: 'Stan Stranger' });
    unapprovedHospital = await createUser(db, {
      email: 'unapproved-hospital@example.com',
      roles: ['HOSPITAL'],
    });
    admin = await createUser(db, { email: 'admin@example.com', roles: ['ADMIN'] });
    admin2 = await createUser(db, { email: 'admin2@example.com', roles: ['ADMIN'] });

    const created = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', bearer(owner))
      .send({
        bloodGroup: 'B+',
        unitsRequested: 1,
        hospitalName: 'City Care',
        hospitalCity: 'Pune',
        hospitalArea: 'Baner',
        neededBy: NEEDED_BY,
        priority: 'CRITICAL',
        contactPhone: '+919111111111',
        contactShareConsent: true,
        accuracyConfirmed: true,
      })
      .expect(201);
    requestId = created.body.data.id;
  });

  afterAll(async () => {
    await db.close();
  });

  it('does not expose a submitted request to an unrelated authenticated user', async () => {
    const detail = await request(app)
      .get(`/api/v1/requests/${requestId}`)
      .set('Authorization', bearer(stranger))
      .expect(404);
    expect(detail.body.error.code).toBe('NOT_FOUND');

    const responses = await request(app)
      .get(`/api/v1/requests/${requestId}/responses`)
      .set('Authorization', bearer(stranger))
      .expect(404);
    expect(responses.body.error.code).toBe('NOT_FOUND');
  });

  it('blocks unapproved hospital accounts from verifier workflows', async () => {
    await request(app)
      .get('/api/v1/hospital/queue')
      .set('Authorization', bearer(unapprovedHospital))
      .expect(403);

    await request(app)
      .post(`/api/v1/requests/${requestId}/verify`)
      .set('Authorization', bearer(unapprovedHospital))
      .send({ reason: 'Trying to verify without approval' })
      .expect(403);
  });

  it('prevents role escalation through registration metadata', async () => {
    const id = crypto.randomUUID();
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, $3::jsonb)`,
      [id, 'pretender@example.com', JSON.stringify({ account_type: 'HOSPITAL' })],
    );
    const roles = await db.query<{ role: string }>(
      'select role from public.user_roles where user_id = $1 order by role',
      [id],
    );
    expect(roles.rows.map((row) => row.role)).toEqual(['REQUESTER']);
  });

  it('restricts admin endpoints and prevents administrator-on-administrator suspension', async () => {
    await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', bearer(stranger))
      .expect(403);

    const response = await request(app)
      .patch(`/api/v1/admin/users/${admin2.id}/status`)
      .set('Authorization', bearer(admin))
      .send({ status: 'SUSPENDED', reason: 'Attempting to suspend another administrator' })
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('suspends an account and immediately rejects its tokens', async () => {
    await request(app)
      .patch(`/api/v1/admin/users/${stranger.id}/status`)
      .set('Authorization', bearer(admin))
      .send({ status: 'SUSPENDED', reason: 'Repeated abusive requests reported by multiple users' })
      .expect(200);

    const blocked = await request(app)
      .get('/api/v1/me')
      .set('Authorization', bearer(stranger))
      .expect(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('enforces RLS for browser-style sessions', async () => {
    // anon has no table grants at all
    await expect(
      asRole(db, 'anon', null, () => db.query('select * from public.profiles')),
    ).rejects.toThrow(/permission denied/i);

    // authenticated can only read their own profile
    const own = await asRole(db, 'authenticated', owner.id, () =>
      db.query<{ id: string }>('select id from public.profiles'),
    );
    expect(own.rows.map((row) => row.id)).toEqual([owner.id]);

    // account status is not client-writable
    await expect(
      asRole(db, 'authenticated', owner.id, () =>
        db.query("update public.profiles set account_status = 'SUSPENDED' where id = $1", [owner.id]),
      ),
    ).rejects.toThrow(/permission denied/i);

    // lifecycle tables are backend-only
    await expect(
      asRole(db, 'authenticated', owner.id, () =>
        db.query('insert into public.donor_responses (request_id, donor_id) values ($1, $2)', [
          requestId,
          owner.id,
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);

    // admins can read the audit trail; ordinary users cannot
    const adminAudit = await asRole(db, 'authenticated', admin.id, () =>
      db.query<{ count: number }>('select count(*)::int as count from public.audit_events'),
    );
    expect(adminAudit.rows[0]!.count).toBeGreaterThan(0);

    const userAudit = await asRole(db, 'authenticated', owner.id, () =>
      db.query<{ count: number }>('select count(*)::int as count from public.audit_events'),
    );
    expect(userAudit.rows[0]!.count).toBe(0);
  });

  it('does not reveal requester contact details in the public donor feed', async () => {
    // The request is still SUBMITTED, so the feed is empty. Verify it via an
    // administrator-friendly direct update is intentionally not used here;
    // the workflow test covers the verified-feed masking path.
    const feed = await request(app)
      .get('/api/v1/requests/feed')
      .set('Authorization', bearer(unapprovedHospital))
      .expect(200);
    expect(feed.body.data.items).toHaveLength(0);
  });
});
