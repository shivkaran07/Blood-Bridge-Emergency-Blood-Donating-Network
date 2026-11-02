import type { EmailConfig } from '../config/env.js';
import type { Db } from '../db/database.js';
import type { Logger } from '../lib/logger.js';

interface ClaimedEmail {
  id: string;
  email: string;
  attempt_count: number;
}

export async function deliverEmailOutboxBatch(
  db: Db,
  config: EmailConfig,
  logger: Logger,
  batchSize = 20,
): Promise<number> {
  if (!config.resendApiKey || !config.fromAddress) return 0;

  const claimed = await db.transaction(async (tx) => {
    await tx.query(
      `update public.notification_email_outbox
          set status = 'FAILED', lease_expires_at = null
        where status = 'SENDING'
          and attempt_count >= 5
          and lease_expires_at <= now()`,
    );
    await tx.query(
      `update public.notification_email_outbox o
          set status = 'EXPIRED', lease_expires_at = null
         from public.notifications n
         join public.profiles p on p.id = n.recipient_user_id
         left join auth.users u on u.id = p.id
        where o.notification_id = n.id
          and o.status in ('PENDING', 'SENDING')
          and (
            p.email_notifications_enabled = false
            or u.email is null
            or u.email_confirmed_at is null
            or n.created_at < now() - interval '30 days'
          )`,
    );

    const result = await tx.query<ClaimedEmail>(
      `with available as (
         select o.id, u.email
           from public.notification_email_outbox o
           join public.notifications n on n.id = o.notification_id
           join public.profiles p on p.id = n.recipient_user_id
           join auth.users u on u.id = p.id
          where p.email_notifications_enabled = true
            and u.email is not null
            and u.email_confirmed_at is not null
            and o.attempt_count < 5
            and (
              (o.status = 'PENDING' and o.next_attempt_at <= now())
              or (o.status = 'SENDING' and o.lease_expires_at <= now())
            )
          order by o.next_attempt_at, o.created_at
          for update of o skip locked
          limit $1
       )
       update public.notification_email_outbox o
          set status = 'SENDING',
              attempt_count = o.attempt_count + 1,
              lease_expires_at = now() + interval '2 minutes'
         from available
        where o.id = available.id
        returning o.id, available.email, o.attempt_count`,
      [batchSize],
    );
    return result.rows;
  });

  let delivered = 0;
  for (const email of claimed) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.fromAddress,
          to: [email.email],
          subject: 'New BloodBridge notification',
          text: [
            'You have a new BloodBridge update.',
            '',
            'Sign in to BloodBridge to view your notifications:',
            config.appUrl,
            '',
            'This email does not include request or health details. You can turn off email alerts in Profile Settings.',
          ].join('\n'),
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, attempt: email.attempt_count },
          'Email provider rejected a notification',
        );
        await scheduleRetry(db, email);
        continue;
      }

      await db.query(
        `update public.notification_email_outbox
            set status = 'SENT', sent_at = now(), lease_expires_at = null
          where id = $1 and status = 'SENDING'`,
        [email.id],
      );
      delivered += 1;
    } catch (error) {
      logger.warn(
        {
          err: error instanceof Error ? { message: error.message, name: error.name } : undefined,
          attempt: email.attempt_count,
        },
        'Email notification delivery failed',
      );
      await scheduleRetry(db, email);
    }
  }

  return delivered;
}

async function scheduleRetry(db: Db, email: ClaimedEmail): Promise<void> {
  const terminal = email.attempt_count >= 5;
  const retryAt = new Date(Date.now() + Math.min(60 * 2 ** (email.attempt_count - 1), 3600) * 1000);
  await db.query(
    `update public.notification_email_outbox
        set status = $2,
            next_attempt_at = $3,
            lease_expires_at = null
      where id = $1 and status = 'SENDING'`,
    [email.id, terminal ? 'FAILED' : 'PENDING', retryAt],
  );
}
