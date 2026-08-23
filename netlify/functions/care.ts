import type { Config, Context } from '@netlify/functions';
import { buildCareOverview } from '../../src/features/care-overview/buildCareOverview.js';
import { buildWeeklyReportContext } from '../../src/features/ai-report/buildWeeklyFacts.js';
import { loadWeeklySourceData } from '../../src/features/ai-report/loadWeeklySourceData.js';
import { canCreateAuthorization, createCareAdminClient, hasActiveCareAccess, normalizeCaregiverEmail } from './_shared/careAccess.ts';
import { verifySupabaseUser } from './_shared/verifySupabaseUser.ts';

const readEnv = (key: string) => globalThis.Netlify?.env?.get?.(key) ?? process.env[key] ?? '';
const json = (value: unknown, status = 200) => Response.json(value, { status });
const tokenFrom = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';

type Deps = { verifyUser: (token: string) => Promise<any>; admin: any; now: () => Date };

const authenticate = async (request: Request, deps: Deps) => {
  const token = tokenFrom(request);
  if (!token) return { user: null, response: json({ code: 'AUTH_REQUIRED' }, 401) };
  try {
    const user = await deps.verifyUser(token);
    return user?.id ? { user, response: null } : { user: null, response: json({ code: 'AUTH_REQUIRED' }, 401) };
  } catch {
    return { user: null, response: json({ code: 'AUTH_UNAVAILABLE' }, 503) };
  }
};

async function createAuthorization(request: Request, deps: Deps) {
  const auth = await authenticate(request, deps);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  const result = canCreateAuthorization({ ownerEmail: auth.user.email, caregiverEmail: body?.caregiverEmail });
  if (!result.ok) return json({ code: result.code }, 400);
  const { error } = await deps.admin.from('care_authorizations').insert({
    owner_user_id: auth.user.id,
    caregiver_email_normalized: result.email,
    owner_label: '家人',
    status: 'pending',
    created_at: deps.now().toISOString(),
  });
  if (error && error.code !== '23505') return json({ code: 'CARE_AUTHORIZATION_CREATE_FAILED' }, 503);
  return json({ status: 'pending' }, 202);
}

async function claimAuthorizations(request: Request, deps: Deps) {
  const auth = await authenticate(request, deps);
  if (auth.response) return auth.response;
  const email = normalizeCaregiverEmail(auth.user.email || '');
  if (!email) return json({ code: 'CARE_AUTHORIZATION_EMAIL_UNAVAILABLE' }, 400);
  const { data, error } = await deps.admin
    .from('care_authorizations')
    .update({ caregiver_user_id: auth.user.id, status: 'active', activated_at: deps.now().toISOString() })
    .eq('caregiver_email_normalized', email)
    .eq('status', 'pending')
    .select('id');
  if (error) return json({ code: 'CARE_AUTHORIZATION_CLAIM_FAILED' }, 503);
  return json({ activated: data?.length || 0 });
}

async function revokeAuthorization(request: Request, context: Pick<Context, 'params'>, deps: Deps) {
  const auth = await authenticate(request, deps);
  if (auth.response) return auth.response;
  const id = context.params?.id;
  if (!id) return json({ code: 'CARE_AUTHORIZATION_NOT_FOUND' }, 404);
  const { data, error } = await deps.admin
    .from('care_authorizations')
    .update({ status: 'revoked', revoked_at: deps.now().toISOString() })
    .eq('id', id)
    .eq('owner_user_id', auth.user.id)
    .in('status', ['pending', 'active'])
    .select('id');
  if (error) return json({ code: 'CARE_AUTHORIZATION_REVOKE_FAILED' }, 503);
  return data?.length ? json({ status: 'revoked' }) : json({ code: 'CARE_AUTHORIZATION_NOT_FOUND' }, 404);
}

async function subjects(request: Request, deps: Deps) {
  const auth = await authenticate(request, deps);
  if (auth.response) return auth.response;
  const { data, error } = await deps.admin
    .from('care_authorizations')
    .select('id, owner_user_id, owner_label, activated_at')
    .eq('caregiver_user_id', auth.user.id)
    .eq('status', 'active')
    .order('activated_at', { ascending: false });
  if (error) return json({ code: 'CARE_SUBJECTS_LOAD_FAILED' }, 503);
  return json({ subjects: data || [] });
}

async function overview(request: Request, deps: Deps) {
  const auth = await authenticate(request, deps);
  if (auth.response) return auth.response;
  const subjectUserId = new URL(request.url).searchParams.get('subject') || '';
  if (!subjectUserId || !(await hasActiveCareAccess(deps.admin, auth.user.id, subjectUserId))) {
    return json({ code: 'CARE_ACCESS_DENIED' }, 403);
  }
  try {
    const now = deps.now();
    const sourceData = await loadWeeklySourceData({ client: deps.admin, userId: subjectUserId, now });
    const context = buildWeeklyReportContext(sourceData, now);
    return json({ overview: buildCareOverview(sourceData, now), facts: context.facts, medicationNamesByRef: context.medicationNamesByRef });
  } catch {
    return json({ code: 'CARE_OVERVIEW_LOAD_FAILED' }, 503);
  }
}

export async function handleCareRequest(request: Request, context: Pick<Context, 'params'>, deps: Deps) {
  const pathname = new URL(request.url).pathname;
  if (request.method === 'POST' && pathname === '/api/care/authorizations') return createAuthorization(request, deps);
  if (request.method === 'POST' && pathname === '/api/care/authorizations/claim') return claimAuthorizations(request, deps);
  if (request.method === 'DELETE' && context.params?.id) return revokeAuthorization(request, context, deps);
  if (request.method === 'GET' && pathname === '/api/care/subjects') return subjects(request, deps);
  if (request.method === 'GET' && pathname === '/api/care/overview') return overview(request, deps);
  return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
}

export default async (request: Request, context: Context) => {
  const url = readEnv('SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
  const secret = readEnv('SUPABASE_SECRET_KEY') || readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secret) return json({ code: 'CARE_NOT_CONFIGURED' }, 503);
  return handleCareRequest(request, context, { verifyUser: verifySupabaseUser, admin: createCareAdminClient(url, secret), now: () => new Date() });
};

export const config: Config = {
  path: ['/api/care/authorizations', '/api/care/authorizations/claim', '/api/care/authorizations/:id', '/api/care/subjects', '/api/care/overview'],
  method: ['GET', 'POST', 'DELETE'],
};
