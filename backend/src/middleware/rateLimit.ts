import { rateLimit, ipKeyGenerator, type RateLimitRequestHandler, type Store } from 'express-rate-limit';
import type { AppConfig } from '../config/env.js';

function rateLimitHandler(message: string) {
  return (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message },
    });
  };
}

export interface RateLimiters {
  global: RateLimitRequestHandler;
  write: RateLimitRequestHandler;
  requestCreate: RateLimitRequestHandler;
  responseCreate: RateLimitRequestHandler;
  hospitalApply: RateLimitRequestHandler;
}

export type RateLimitStoreFactory = (prefix: string) => Store;

/**
 * Rate limiters. The global limiter is per IP; write limiters are per
 * authenticated user once authentication has run.
 */
export function createRateLimiters(
  config: AppConfig,
  createStore?: RateLimitStoreFactory,
): RateLimiters {
  const common = {
    standardHeaders: 'draft-7' as const,
    legacyHeaders: false,
    skip: () => !config.rateLimit.enabled,
  };
  const storeOptions = (prefix: string) => {
    const sharedStore = createStore?.(prefix);
    return sharedStore ? { store: sharedStore } : {};
  };

  const userKey = (req: { auth?: { user: { id: string } }; ip?: string }) =>
    req.auth?.user.id ?? ipKeyGenerator(req.ip ?? '0.0.0.0');

  const global = rateLimit({
    ...common,
    ...storeOptions('global:'),
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    handler: rateLimitHandler('Too many requests. Please wait and try again.'),
  });

  const write = rateLimit({
    ...common,
    ...storeOptions('write:'),
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.writeMax,
    keyGenerator: userKey,
    handler: rateLimitHandler('You are sending changes too frequently. Please wait and try again.'),
  });

  const requestCreate = rateLimit({
    ...common,
    ...storeOptions('request-create:'),
    windowMs: 60 * 60 * 1000,
    limit: config.rateLimit.requestCreateMax,
    keyGenerator: userKey,
    handler: rateLimitHandler(
      'You have reached the limit for new blood requests this hour. Existing requests can still be managed.',
    ),
  });

  const responseCreate = rateLimit({
    ...common,
    ...storeOptions('response-create:'),
    windowMs: 60 * 60 * 1000,
    limit: config.rateLimit.responseMax,
    keyGenerator: userKey,
    handler: rateLimitHandler('You have reached the limit for donor responses this hour.'),
  });

  const hospitalApply = rateLimit({
    ...common,
    ...storeOptions('hospital-apply:'),
    windowMs: 60 * 60 * 1000,
    limit: 5,
    keyGenerator: userKey,
    handler: rateLimitHandler('Too many hospital application attempts. Please try again later.'),
  });

  return { global, write, requestCreate, responseCreate, hospitalApply };
}
