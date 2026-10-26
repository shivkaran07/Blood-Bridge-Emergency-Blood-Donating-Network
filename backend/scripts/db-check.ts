import 'dotenv/config';
import { loadConfig } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createPgDb } from '../src/db/database.js';

const config = loadConfig();
const logger = createLogger({ ...config, logLevel: 'info' });
const db = createPgDb(config, logger);

try {
  const version = await db.query<{ version: string }>('select version() as version');
  console.log(`Connected: ${version.rows[0]?.version ?? 'unknown server'}`);

  const migrations = await db.query<{ version: string; applied_at: string }>(
    'select version, applied_at from public.schema_migrations order by version',
  );
  console.log(`\nApplied migrations (${migrations.rows.length}):`);
  for (const row of migrations.rows) {
    console.log(`  - ${row.version} (${new Date(row.applied_at).toISOString()})`);
  }

  const tables = await db.query<{
    table_name: string;
    row_security: string;
  }>(
    `select c.relname as table_name,
            case when c.relrowsecurity then 'enabled' else 'disabled' end as row_security
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and c.relname <> 'schema_migrations'
      order by c.relname`,
  );
  const withoutRls = tables.rows.filter((row) => row.row_security === 'disabled');
  console.log(`\nPublic tables: ${tables.rows.length} (RLS disabled: ${withoutRls.length})`);
  for (const row of withoutRls) console.log(`  ! ${row.table_name}`);

  const counts = await db.query<{
    profiles: number;
    requests: number;
    responses: number;
    blockchain_transactions: number;
  }>(
    `select
       (select count(*)::int from public.profiles) as profiles,
       (select count(*)::int from public.blood_requests) as requests,
       (select count(*)::int from public.donor_responses) as responses,
       (select count(*)::int from public.blockchain_transactions) as blockchain_transactions`,
  );
  const summary = counts.rows[0]!;
  console.log(
    `\nRows: profiles=${summary.profiles}, requests=${summary.requests}, responses=${summary.responses}, blockchain_transactions=${summary.blockchain_transactions}`,
  );
  console.log(
    '\nNote: blockchain_transactions is a Part 2 scaffold. Non-zero values only make sense after the Part 2 integration is deployed.',
  );

  if (withoutRls.length > 0) {
    console.error('\nFAILED: every public table must have RLS enabled.');
    process.exitCode = 1;
  } else {
    console.log('\nOK: schema, migrations and RLS checks passed.');
  }
} catch (error) {
  logger.error({ err: error }, 'Database check failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.close();
}
