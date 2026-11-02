import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, createTestDb, createUser, bearer, type PgliteDb } from './helpers.js';

describe('API foundation', () => {
  let db: PgliteDb;
  let app: Express;

  beforeAll(async () => {
    db = await createTestDb();
    app = createTestApp(db);
  });

  afterAll(async () => {
    await db.close();
  });

  it('reports health and truthful metadata', async () => {
    const health = await request(app).get('/api/v1/health').expect(200);
    expect(health.body.data.status).toBe('ok');
    expect(health.body.data.phase).toBe('PART_2');

    const meta = await request(app).get('/api/v1/meta').expect(200);
    // The default test config has no contract configured - the honest state
    // is a database-backed deployment that never claims on-chain activity.
    expect(meta.body.data.blockchain.verificationMode).toBe('DATABASE');
    expect(meta.body.data.blockchain.contractConfigured).toBe(false);
    expect(meta.body.data.blockchain.operational).toBe(false);
  });

  it('requires authentication for protected endpoints', async () => {
    const response = await request(app).get('/api/v1/me').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns a consistent 404 envelope', async () => {
    const user = await createUser(db, { email: 'notfound@example.com' });
    const response = await request(app)
      .get('/api/v1/does-not-exist')
      .set('Authorization', bearer(user))
      .expect(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(response.body.requestId).toBeTruthy();
  });
});
