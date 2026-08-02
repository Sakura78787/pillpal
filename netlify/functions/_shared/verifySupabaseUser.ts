import { createClient } from '@supabase/supabase-js';

const readEnv = (key: string): string => {
  const netlifyEnv = globalThis.Netlify?.env?.get?.(key);
  if (netlifyEnv !== undefined) return netlifyEnv;
  return process.env[key] || '';
};

export async function verifySupabaseUser(accessToken: string) {
  const supabaseUrl = readEnv('VITE_SUPABASE_URL');
  const publishableKey = readEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Supabase auth is not configured');
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw new Error('Invalid access token');
  }

  return data.user;
}
