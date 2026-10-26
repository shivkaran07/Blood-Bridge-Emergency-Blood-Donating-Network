import 'dotenv/config';
import { loadConfig } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { createPgDb } from './db/database.js';
import { SupabaseAuthVerifier } from './auth/authVerifier.js';
import { createApp } from './app.js';
import { expireStaleRequests } from './services/requestService.js';

const config = loadConfig();
const logger = createLogger(config);
const db = createPgDb(config, logger);
const verifier = new SupabaseAuthVerifier(config, logger);
const app = createApp({ config, db, verifier, logger });

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      environment: config.nodeEnv,
      blockchainEnabledByConfiguration: config.blockchain.enabled,
      blockchainOperational: false,
    },
    'BloodBridge API listening',
  );
});

/**
 * Opportunistic expiry sweep. Reads also sweep, so this is a safety net for
 * idle periods rather than the only mechanism.
 */
const sweepTimer = setInterval(() => {
  expireStaleRequests({ db, config, logger })
    .then((count) => {
      if (count > 0) logger.info({ expired: count }, 'Expired stale blood requests');
    })
    .catch((error) => logger.error({ err: error }, 'Request expiry sweep failed'));
}, 60_000);
sweepTimer.unref();

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down BloodBridge API');
  clearInterval(sweepTimer);

  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      await db.close();
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
