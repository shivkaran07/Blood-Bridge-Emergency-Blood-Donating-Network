import type { Db } from '../db/database.js';
import type { AppConfig } from '../config/env.js';
import type { Logger } from '../lib/logger.js';

export interface ServiceDeps {
  db: Db;
  config: AppConfig;
  logger: Logger;
}
