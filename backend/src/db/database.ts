import pg from 'pg';
import type { Logger } from '../lib/logger.js';
import type { AppConfig } from '../config/env.js';

const { Pool } = pg;

export type SqlValue = string | number | boolean | Date | null | Record<string, unknown> | unknown[];

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Minimal database interface. The production adapter uses `pg`; the test
 * adapter uses PGlite. Keeping services on this interface lets the complete
 * backend run against a real PostgreSQL-compatible engine in tests.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class PgDb implements Db {
  constructor(
    private readonly pool: pg.Pool,
    private readonly inTransaction = false,
  ) {}

  async query<T>(sql: string, params: SqlValue[] = []): Promise<QueryResult<T>> {
    const result = await this.pool.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    if (this.inTransaction) {
      // Nested calls should reuse the active transaction rather than issuing
      // a second BEGIN (which PostgreSQL treats as a warning and can silently
      // commit at the wrong level).
      return fn(this);
    }
    const client = await this.pool.connect();
    const tx = new PgDb(client as unknown as pg.Pool, true);
    try {
      await client.query('begin');
      const result = await fn(tx);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPgDb(config: AppConfig, logger: Logger): Db {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });

  pool.on('error', (error) => {
    logger.error({ err: error }, 'Unexpected PostgreSQL pool error');
  });

  return new PgDb(pool);
}
