import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '../config/env.js';
import type { AuthenticatedUser } from '../types/domain.js';
import { UnauthorizedError, ServiceUnavailableError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';

export interface AuthVerifier {
  /** Validates a Supabase access token and returns the trusted user identity. */
  verifyToken(token: string): Promise<AuthenticatedUser>;
}

/**
 * Server-side Supabase token validation. We use auth.getUser (rather than
 * decoding the JWT in the application) so revoked/expired sessions are
 * rejected by Supabase Auth.
 */
export class SupabaseAuthVerifier implements AuthVerifier {
  private readonly client: SupabaseClient;

  constructor(
    config: Pick<AppConfig, 'supabaseUrl' | 'supabaseServiceRoleKey'>,
    private readonly logger: Logger,
  ) {
    this.client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    if (!token || token.length < 10) {
      throw new UnauthorizedError('A valid session is required.');
    }

    try {
      const { data, error } = await this.client.auth.getUser(token);
      if (error || !data.user) {
        throw new UnauthorizedError('Your session is invalid or has expired. Please sign in again.');
      }
      return {
        id: data.user.id,
        email: data.user.email ?? null,
        emailConfirmedAt: data.user.email_confirmed_at ?? null,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      // Never log the token or the authorization header.
      this.logger.error(
        { err: { message: (error as Error).message, name: (error as Error).name } },
        'Supabase token verification failed',
      );
      throw new ServiceUnavailableError(
        'Unable to verify your session right now. Please try again shortly.',
      );
    }
  }
}
