import 'dotenv/config';
import { loadConfig } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createPgDb } from '../src/db/database.js';
import { writeAudit } from '../src/services/notificationService.js';

const email = process.argv.slice(2).find((value) => !value.startsWith('--'));
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: npm run grant-admin -w backend -- admin@example.com');
  process.exit(1);
}

const config = loadConfig();
const logger = createLogger({ ...config, logLevel: 'info' });
const db = createPgDb(config, logger);

try {
  const user = await db.query<{ id: string; email: string }>(
    'select id, email from auth.users where lower(email) = lower($1) limit 1',
    [email],
  );
  if (user.rows.length === 0) {
    console.error(`No Supabase Auth user exists with email ${email}. Create the account first.`);
    process.exitCode = 1;
  } else {
    const target = user.rows[0]!;
    await db.transaction(async (tx) => {
      // Defensive: normally the signup trigger has already created this row.
      await tx.query(
        `insert into public.profiles (id, full_name)
         values ($1, $2)
         on conflict (id) do nothing`,
        [target.id, target.email.split('@')[0] ?? 'Administrator'],
      );
      await tx.query(
        `insert into public.user_roles (user_id, role, granted_by)
         values ($1, 'ADMIN', null)
         on conflict (user_id, role) do nothing`,
        [target.id],
      );
      await writeAudit(tx, {
        actorUserId: null,
        requestId: null,
        eventType: 'ROLE_GRANTED',
        metadata: { targetUserId: target.id, role: 'ADMIN', source: 'break-glass-script' },
      });
    });
    console.log(`ADMIN role granted to ${email} (${target.id}).`);
    console.log('Sign out and sign in again so the API reloads the role context.');
  }
} catch (error) {
  logger.error({ err: error }, 'Failed to grant administrator role');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.close();
}
