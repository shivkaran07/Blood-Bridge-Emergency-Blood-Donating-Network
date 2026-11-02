import type { SupabaseClient } from '@supabase/supabase-js';
import { env, supabaseConfigured } from './env';

/**
 * Browser Supabase client. Only the publishable/anon key is used here; the
 * service-role key lives exclusively on the backend. Load the SDK on demand so
 * public pages do not have to parse the authentication client before rendering.
 */
let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured) return Promise.resolve(null);

  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    }),
  );
  return clientPromise;
}
