import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createPgDb } from '../src/db/database.js';
import { runMigrations } from '../src/db/migrate.js';

const config = loadConfig();
const logger = createLogger({ ...config, logLevel: 'info' });
const db = createPgDb(config, logger);
const migrationsDir = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));

try {
  const result = await runMigrations(db, migrationsDir, logger);
  logger.info(
    { applied: result.applied, skipped: result.skipped.length },
    'Database migrations complete',
  );
  if (result.applied.length === 0) {
    console.log('Database is up to date. No migrations applied.');
  } else {
    console.log(`Applied ${result.applied.length} migration(s):`);
    for (const file of result.applied) console.log(`  - ${file}`);
  }
} catch (error) {
  logger.error({ err: error }, 'Migration failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.close();
}
