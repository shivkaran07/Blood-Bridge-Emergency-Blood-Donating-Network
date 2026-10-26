import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config/env.js';
import type { Db } from './db/database.js';
import type { AuthVerifier } from './auth/authVerifier.js';
import type { Logger } from './lib/logger.js';
import type { ServiceDeps } from './services/deps.js';
import { createAuthenticate } from './middleware/auth.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestContext } from './middleware/requestContext.js';
import { createRateLimiters } from './middleware/rateLimit.js';
import { createApiRouter } from './routes/index.js';

export interface AppDependencies {
  config: AppConfig;
  db: Db;
  verifier: AuthVerifier;
  logger: Logger;
}

/**
 * Builds the Express application. Dependencies are injected so tests can run
 * the real routes against PGlite and a stub auth verifier.
 */
export function createApp(deps: AppDependencies): Express {
  const app = express();
  const { config, db, logger } = deps;

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(requestContext);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed'));
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  const limiters = createRateLimiters(config);
  app.use('/api/v1', limiters.global);

  const authenticate = createAuthenticate(db, deps.verifier);
  const serviceDeps: ServiceDeps = { db, config, logger };
  app.use('/api/v1', createApiRouter(serviceDeps, authenticate, limiters));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
