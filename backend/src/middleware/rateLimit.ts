import { rateLimit, ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';
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

/**
 * Rate limiters. The global limiter is per IP; write limiters are per
 * authenticated user once authentication has run.
 */
export function createRateLimiters(config: AppConfig): RateLimiters {
  const common = {
    standardHeaders: 'draft-7' as const,
    legacyHeaders: false,
    skip: () => !config.rateLimit.enabled,
  };

  const userKey = (req: { auth?: { user: { id: string } }; ip?: string }) =>
    req.auth?.user.id ?? ipKeyGenerator(req.ip ?? '0.0.0.0');

  const global = rateLimit({
    ...common,
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    handler: rateLimitHandler('Too many requests. Please wait and try again.'),
  });

  const write = rateLimit({
    ...common,
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.writeMax,
    keyGenerator: userKey,
    handler: rateLimitHandler('You are sending changes too frequently. Please wait and try again.'),
  });

  const requestCreate = rateLimit({
    ...common,
    windowMs: 60 * 60 * 1000,
    limit: config.rateLimit.requestCreateMax,
    keyGenerator: userKey,
    handler: rateLimitHandler(
      'You have reached the limit for new blood requests this hour. Existing requests can still be managed.',
    ),
  });

  const responseCreate = rateLimit({
    ...common,
    windowMs: 60 * 60 * 1000,
    limit: config.rateLimit.responseMax,
    keyGenerator: userKey,
    handler: rateLimitHandler('You have reached the limit for donor responses this hour.'),
  });

  const hospitalApply = rateLimit({
    ...common,
    windowMs: 60 * 60 * 1000,
    limit: 5,
    keyGenerator: userKey,
    handler: rateLimitHandler('Too many hospital application attempts. Please try again later.'),
  });

  return { global, write, requestCreate, responseCreate, hospitalApply };
}
