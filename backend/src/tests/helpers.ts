import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import pino from 'pino';
import type { AppConfig } from '../config/env.js';
import type { Db, QueryResult, SqlValue } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { silentLogger } from '../lib/logger.js';
import type { AuthVerifier } from '../auth/authVerifier.js';
import type { IdentityAdmin } from '../auth/authVerifier.js';
import type { ChainAdapter } from '../blockchain/adapter.js';
import type { AuthenticatedUser } from '../types/domain.js';
import { UnauthorizedError } from '../lib/errors.js';
import { createApp } from '../app.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));

export class PgliteDb implements Db {
  constructor(
    private readonly client: PGlite,
    private readonly inTransaction = false,
  ) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: SqlValue[] = [],
  ): Promise<QueryResult<T>> {
    const result = await this.client.query<T>(sql, params as unknown[]);
    return {
      rows: result.rows as T[],
      rowCount: result.affectedRows ?? result.rows.length,
    };
  }

  async exec(sql: string): Promise<void> {
    await this.client.exec(sql);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn(this);
    await this.client.exec('begin');
    const tx = new PgliteDb(this.client, true);
    try {
      const result = await fn(tx);
      await this.client.exec('commit');
      return result;
    } catch (error) {
      await this.client.exec('rollback').catch(() => undefined);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  raw(): PGlite {
    return this.client;
  }
}

/**
 * Creates a PostgreSQL-compatible database with the Supabase auth stubs the
 * real migrations depend on, then applies the version-controlled migrations.
 */
export async function createTestDb(): Promise<PgliteDb> {
  const client = new PGlite();
  await client.waitReady;
  await client.exec(`
    create schema if not exists auth;

    create table if not exists auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz not null default now(),
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
    end
    $$;
  `);

  const db = new PgliteDb(client);
  await runMigrations(db, MIGRATIONS_DIR);
  return db;
}

/** Runs a callback as a browser-like PostgreSQL role with a JWT subject. */
export async function asRole<T>(
  db: PgliteDb,
  role: 'anon' | 'authenticated',
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
    await db.exec(`set local role ${role}`);
    return await fn();
  } finally {
    await db.exec('rollback');
  }
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

const KNOWN_USERS = new Map<string, AuthenticatedUser>();

export class StubAuthVerifier implements AuthVerifier {
  async verifyToken(token: string): Promise<AuthenticatedUser> {
    const user = KNOWN_USERS.get(token);
    if (!user) throw new UnauthorizedError('Unknown test token');
    return user;
  }
}

export function registerTestToken(user: AuthenticatedUser): string {
  const token = `test-token-${user.id}`;
  KNOWN_USERS.set(token, user);
  return token;
}

export async function createUser(
  db: PgliteDb,
  input: {
    email: string;
    fullName?: string;
    roles?: Array<'REQUESTER' | 'DONOR' | 'HOSPITAL' | 'ADMIN'>;
    accountType?: 'REQUESTER' | 'DONOR';
    accountStatus?: 'ACTIVE' | 'SUSPENDED';
  },
): Promise<TestUser> {
  const id = crypto.randomUUID();
  const fullName = input.fullName ?? input.email.split('@')[0]!;
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, $3::jsonb)`,
    [
      id,
      input.email,
      JSON.stringify({
        full_name: fullName,
        account_type: input.accountType ?? 'REQUESTER',
        city: 'Pune',
        area: 'Kothrud',
      }),
    ],
  );

  for (const role of input.roles ?? []) {
    await db.query(
      `insert into public.user_roles (user_id, role) values ($1, $2)
       on conflict (user_id, role) do nothing`,
      [id, role],
    );
  }

  if (input.accountStatus === 'SUSPENDED') {
    await db.query('update public.profiles set account_status = $2 where id = $1', [
      id,
      'SUSPENDED',
    ]);
  }

  await db.query('update public.profiles set full_name = $2 where id = $1', [id, fullName]);

  const user: AuthenticatedUser = {
    id,
    email: input.email,
    emailConfirmedAt: new Date().toISOString(),
    authTime: Math.floor(Date.now() / 1000),
  };
  return { id, email: input.email, token: registerTestToken(user) };
}

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    corsOrigins: ['http://localhost:5173'],
    logLevel: 'silent',
    trustProxy: false,
    databaseUrl: 'postgres://test',
    databaseSsl: false,
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'test-service-role-key-with-enough-length',
    rateLimit: {
      enabled: false,
      windowMs: 60_000,
      max: 1000,
      writeMax: 1000,
      requestCreateMax: 1000,
      responseMax: 1000,
      redisUrl: null,
    },
    blockchain: {
      enabled: false,
      networkName: 'hardhat-local',
      chainId: 31337,
      rpcUrl: 'http://127.0.0.1:8545',
      contractAddress: null,
      walletChallengeTtlSeconds: 300,
      confirmations: 1,
      receiptTimeoutMs: 120_000,
    },
    email: {
      resendApiKey: null,
      fromAddress: null,
      appUrl: 'http://localhost:5173',
    },
    ...overrides,
  };
}

export function createTestApp(
  db: PgliteDb,
  config: AppConfig = testConfig(),
  chain?: ChainAdapter | null,
  identityAdmin: IdentityAdmin = { anonymizeUser: async () => undefined },
) {
  return createApp({
    config,
    db,
    verifier: new StubAuthVerifier(),
    identityAdmin,
    logger: process.env.TEST_LOG === '1' ? pino({ level: 'error' }) : silentLogger,
    // `undefined` = derive from config (real adapters in ON_CHAIN mode);
    // explicit null forces DATABASE-mode plumbing in tests even when the
    // config says ON_CHAIN.
    chain,
  });
}

export function bearer(user: TestUser): string {
  return `Bearer ${user.token}`;
}
