import type { Db } from '../db/database.js';
import type { AppConfig } from '../config/env.js';
import type { Logger } from '../lib/logger.js';
import type { ChainAdapter } from '../blockchain/adapter.js';
import type { IdentityAdmin } from '../auth/authVerifier.js';

export interface ServiceDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
  /**
   * Null in DATABASE mode. When present it is the backend's independent,
   * read-only view of the chain used to verify wallet-signed transactions.
   */
  chain: ChainAdapter | null;
  identityAdmin?: IdentityAdmin | null;
}
