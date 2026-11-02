import dotenv from 'dotenv';
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
import { deriveVerificationMode, loadConfig } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { createPgDb } from './db/database.js';
import { SupabaseAuthVerifier } from './auth/authVerifier.js';
import { createApp } from './app.js';
import { expireStaleRequests } from './services/requestService.js';
import { deliverEmailOutboxBatch } from './services/emailOutboxService.js';

const config = loadConfig();
const logger = createLogger(config);
const db = createPgDb(config, logger);
const verifier = new SupabaseAuthVerifier(config, logger);
const redisClient = config.rateLimit.redisUrl
  ? createClient({ url: config.rateLimit.redisUrl })
  : null;

if (redisClient) {
  redisClient.on('error', (error) => {
    logger.error({ err: error }, 'Rate-limit Redis connection error');
  });
  await redisClient.connect();
}

const app = createApp({
  config,
  db,
  verifier,
  identityAdmin: verifier,
  logger,
  rateLimitStoreFactory: redisClient
    ? (prefix) =>
        new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          prefix: `bloodbridge:rate-limit:${prefix}`,
        })
    : undefined,
});

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      environment: config.nodeEnv,
      verificationMode: deriveVerificationMode(config.blockchain),
    },
    'BloodBridge API listening',
  );
});

/**
 * Opportunistic expiry sweep. Reads also sweep, so this is a safety net for
 * idle periods rather than the only mechanism.
 */
const sweepTimer = setInterval(() => {
  expireStaleRequests({ db, config, logger, chain: null })
    .then((count) => {
      if (count > 0) logger.info({ expired: count }, 'Expired stale blood requests');
    })
    .catch((error) => logger.error({ err: error }, 'Request expiry sweep failed'));
}, 60_000);
sweepTimer.unref();

let emailBatch: Promise<number> | null = null;
const emailTimer =
  config.email.resendApiKey && config.email.fromAddress
    ? setInterval(() => {
        if (emailBatch) return;
        emailBatch = deliverEmailOutboxBatch(db, config.email, logger)
          .catch((error) => {
            logger.error({ err: error }, 'Email notification outbox processing failed');
            return 0;
          })
          .finally(() => {
            emailBatch = null;
          });
      }, 5_000)
    : null;
emailTimer?.unref();

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down BloodBridge API');
  clearInterval(sweepTimer);
  if (emailTimer) clearInterval(emailTimer);

  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      if (emailBatch) await emailBatch;
      await db.close();
      if (redisClient?.isOpen) await redisClient.quit();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
