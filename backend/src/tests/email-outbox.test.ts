import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  bearer,
  createTestApp,
  createTestDb,
  createUser,
  testConfig,
  type PgliteDb,
} from './helpers.js';
import { createNotification } from '../repositories/notificationRepository.js';
import { deliverEmailOutboxBatch } from '../services/emailOutboxService.js';
import { silentLogger } from '../lib/logger.js';

describe('opt-in email notification outbox', () => {
  let db: PgliteDb;
  const emailConfig = {
    resendApiKey: 'test-resend-key',
    fromAddress: 'notifications@example.test',
    appUrl: 'https://bloodbridge.example.test',
  };

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await db.close();
  });

  it('queues only after explicit opt-in and expires pending mail on opt-out', async () => {
    const app = createTestApp(db, testConfig({ email: emailConfig }));
    const optedInUser = await createUser(db, { email: 'opt-in@example.test' });
    const optedOutUser = await createUser(db, { email: 'opt-out@example.test' });

    await createNotification(db, {
      recipientUserId: optedOutUser.id,
      notificationType: 'REQUEST_SUBMITTED',
      title: 'Sensitive request title',
      message: 'Sensitive request details',
      relatedRequestId: null,
    });
    let rows = await db.query<{ count: number }>(
      'select count(*)::int as count from public.notification_email_outbox',
    );
    expect(rows.rows[0]?.count).toBe(0);

    await request(app)
      .patch('/api/v1/me/email-notifications')
      .set('Authorization', bearer(optedInUser))
      .send({ enabled: true })
      .expect(200, { data: { enabled: true } });
    const notification = await createNotification(db, {
      recipientUserId: optedInUser.id,
      notificationType: 'REQUEST_SUBMITTED',
      title: 'Sensitive O+ request at a named hospital',
      message: 'Sensitive patient-related details',
      relatedRequestId: null,
    });

    rows = await db.query<{ count: number }>(
      'select count(*)::int as count from public.notification_email_outbox',
    );
    expect(rows.rows[0]?.count).toBe(1);

    await request(app)
      .patch('/api/v1/me/email-notifications')
      .set('Authorization', bearer(optedInUser))
      .send({ enabled: false })
      .expect(200, { data: { enabled: false } });

    const outbox = await db.query<{ status: string }>(
      'select status from public.notification_email_outbox where notification_id = $1',
      [notification.id],
    );
    expect(outbox.rows[0]?.status).toBe('EXPIRED');
  });

  it('sends generic email content and marks successful outbox delivery', async () => {
    const app = createTestApp(db, testConfig({ email: emailConfig }));
    const user = await createUser(db, { email: 'delivery@example.test' });
    await request(app)
      .patch('/api/v1/me/email-notifications')
      .set('Authorization', bearer(user))
      .send({ enabled: true })
      .expect(200);
    const notification = await createNotification(db, {
      recipientUserId: user.id,
      notificationType: 'REQUEST_SUBMITTED',
      title: 'Sensitive O+ request at a named hospital',
      message: 'Sensitive patient-related details',
      relatedRequestId: null,
    });

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const delivered = await deliverEmailOutboxBatch(db, emailConfig, silentLogger);

    expect(delivered).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body)) as { subject: string; text: string };
    expect(body.subject).toBe('New BloodBridge notification');
    expect(body.text).not.toContain('O+');
    expect(body.text).not.toContain('named hospital');
    expect(body.text).not.toContain('patient-related');

    const outbox = await db.query<{ status: string; sent_at: string | null }>(
      'select status, sent_at from public.notification_email_outbox where notification_id = $1',
      [notification.id],
    );
    expect(outbox.rows[0]?.status).toBe('SENT');
    expect(outbox.rows[0]?.sent_at).not.toBeNull();
  });

  it('schedules a bounded retry when the provider rejects delivery', async () => {
    const app = createTestApp(db, testConfig({ email: emailConfig }));
    const user = await createUser(db, { email: 'retry@example.test' });
    await request(app)
      .patch('/api/v1/me/email-notifications')
      .set('Authorization', bearer(user))
      .send({ enabled: true })
      .expect(200);
    const notification = await createNotification(db, {
      recipientUserId: user.id,
      notificationType: 'REQUEST_SUBMITTED',
      title: 'Private request',
      message: 'Private details',
      relatedRequestId: null,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 })),
    );
    const delivered = await deliverEmailOutboxBatch(db, emailConfig, silentLogger);
    const outbox = await db.query<{ status: string; attempt_count: number; next_attempt_at: Date }>(
      `select status, attempt_count, next_attempt_at
         from public.notification_email_outbox where notification_id = $1`,
      [notification.id],
    );

    expect(delivered).toBe(0);
    expect(outbox.rows[0]?.status).toBe('PENDING');
    expect(outbox.rows[0]?.attempt_count).toBe(1);
    expect(new Date(outbox.rows[0]!.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
  });
});
