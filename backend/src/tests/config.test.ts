import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config/env.js';

function productionEnvironment(redisUrl = ''): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://database.example/db',
    SUPABASE_URL: 'https://project.example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-only-service-role-value',
    REDIS_URL: redisUrl,
  };
}

describe('production rate-limit configuration', () => {
  it('requires a shared Redis-compatible store in production', () => {
    expect(() => loadConfig(productionEnvironment())).toThrow(
      'REDIS_URL is required in production for shared rate limiting.',
    );
  });

  it('accepts a Redis-compatible URL for shared production limits', () => {
    const config = loadConfig(productionEnvironment('rediss://redis.example:6380'));
    expect(config.rateLimit.redisUrl).toBe('rediss://redis.example:6380');
  });

  it('requires both Resend credentials and sender when email alerts are enabled', () => {
    const env = productionEnvironment('rediss://redis.example:6380');
    env.RESEND_API_KEY = 'test-key';
    expect(() => loadConfig(env)).toThrow(
      'RESEND_API_KEY and EMAIL_FROM must both be configured to enable email alerts.',
    );

    env.EMAIL_FROM = 'notifications@example.test';
    const config = loadConfig(env);
    expect(config.email.resendApiKey).toBe('test-key');
    expect(config.email.fromAddress).toBe('notifications@example.test');
  });
});
