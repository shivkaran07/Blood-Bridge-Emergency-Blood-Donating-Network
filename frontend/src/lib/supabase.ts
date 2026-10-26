import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, supabaseConfigured } from './env';

/**
 * Browser Supabase client. Only the publishable/anon key is used here; the
 * service-role key lives exclusively on the backend.
 */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;
