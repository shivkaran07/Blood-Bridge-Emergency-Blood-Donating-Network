/**
 * Public build-time configuration. Vite inlines VITE_* values, so this file must
 * never contain secrets. Missing values are reported in the UI instead of
 * crashing the bundle.
 */

function read(key: keyof ImportMetaEnv): string {
  return (import.meta.env[key] ?? '').trim();
}

export const env = {
  supabaseUrl: read('VITE_SUPABASE_URL'),
  supabaseAnonKey: read('VITE_SUPABASE_ANON_KEY'),
  apiBaseUrl: (read('VITE_API_BASE_URL') || 'http://localhost:4000/api/v1').replace(/\/+$/, ''),
};

export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const configProblems: string[] = [];
if (!env.supabaseUrl) configProblems.push('VITE_SUPABASE_URL is missing.');
if (!env.supabaseAnonKey) configProblems.push('VITE_SUPABASE_ANON_KEY is missing.');
if (env.supabaseUrl && !/^https?:\/\//.test(env.supabaseUrl)) {
  configProblems.push('VITE_SUPABASE_URL must start with https://.');
}
if (env.supabaseAnonKey.startsWith('sb_secret_') || env.supabaseAnonKey.startsWith('service_role')) {
  configProblems.push('A secret/service-role key must never be used in the browser.');
}
