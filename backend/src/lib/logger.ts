import pino from 'pino';
import type { AppConfig } from '../config/env.js';

export type Logger = pino.Logger;

/**
 * Structured logger with redaction for credentials and personal contact data.
 * Request bodies are intentionally never logged.
 */
export function createLogger(config: Pick<AppConfig, 'logLevel' | 'nodeEnv'>): Logger {
  return pino({
    level: config.logLevel,
    enabled: config.nodeEnv !== 'test',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'password',
        'token',
        'access_token',
        'refresh_token',
        'serviceRoleKey',
        'SUPABASE_SERVICE_ROLE_KEY',
        '*.password',
        '*.token',
        '*.access_token',
        '*.refresh_token',
        '*.phone_number',
        '*.phoneNumber',
        '*.requester_contact_phone',
        '*.requesterContactPhone',
        '*.contact_phone',
        '*.contactPhone',
      ],
      censor: '[redacted]',
    },
    base: { service: 'bloodbridge-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const silentLogger = pino({ level: 'silent', enabled: false });
