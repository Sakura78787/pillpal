const readEnv = (key: string): string => {
  const netlifyEnv = globalThis.Netlify?.env?.get?.(key);
  if (netlifyEnv !== undefined) return netlifyEnv;
  return process.env[key] || '';
};

export type SupabaseAuthFailureReason =
  | 'missing_config'
  | 'upstream_unavailable'
  | 'invalid_token';

export class SupabaseAuthVerificationError extends Error {
  reason: SupabaseAuthFailureReason;

  constructor(reason: SupabaseAuthFailureReason) {
    super('Supabase user verification failed');
    this.name = 'SupabaseAuthVerificationError';
    this.reason = reason;
  }
}

export async function verifySupabaseUser(accessToken: string) {
  const supabaseUrl = readEnv('SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
  const publishableKey =
    readEnv('SUPABASE_PUBLISHABLE_KEY') || readEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

  if (!supabaseUrl || !publishableKey) {
    throw new SupabaseAuthVerificationError('missing_config');
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new SupabaseAuthVerificationError('upstream_unavailable');
  }

  if (response.status === 401 || response.status === 403) {
    throw new SupabaseAuthVerificationError('invalid_token');
  }
  if (!response.ok) {
    throw new SupabaseAuthVerificationError('upstream_unavailable');
  }

  const user = await response.json().catch(() => null);
  if (!user?.id) throw new SupabaseAuthVerificationError('upstream_unavailable');
  return user;
}
