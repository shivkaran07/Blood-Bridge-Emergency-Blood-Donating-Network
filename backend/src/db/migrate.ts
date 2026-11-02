import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Db } from './database.js';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Applies version-controlled SQL migrations in filename order. Each file runs
 * in its own transaction and is recorded in public.schema_migrations.
 *
 * Supabase CLI users can use `supabase db push` instead; do not mix both
 * mechanisms on the same database without checking the migration table.
 */
export async function runMigrations(
  db: Db,
  migrationsDir: string,
  logger?: { info: (obj: object, msg: string) => void },
): Promise<MigrationResult> {
  await db.exec(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
    alter table public.schema_migrations enable row level security;
  `);

  // The application migration bookkeeping table must never be exposed through
  // Supabase's default browser grants.
  await db.exec(`
    do $$
    begin
      if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on public.schema_migrations from anon';
      end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute 'revoke all on public.schema_migrations from authenticated';
      end if;
    end
    $$;
  `);

  const entries = await readdir(migrationsDir);
  const files = entries.filter((file) => file.endsWith('.sql')).sort();

  const existing = await db.query<{ version: string }>(
    'select version from public.schema_migrations order by version',
  );
  const appliedSet = new Set(existing.rows.map((row) => row.version));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (appliedSet.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    try {
      await db.exec('begin');
      await db.exec(sql);
      await db.query('insert into public.schema_migrations (version) values ($1)', [file]);
      await db.exec('commit');
      applied.push(file);
      logger?.info({ migration: file }, 'Applied database migration');
    } catch (error) {
      await db.exec('rollback').catch(() => undefined);
      throw new Error(`Migration failed: ${file}\n${(error as Error).message}`, { cause: error });
    }
  }

  return { applied, skipped };
}
