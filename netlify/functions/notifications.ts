import type { Config } from '@netlify/functions';
import { buildCareOverview } from '../../src/features/care-overview/buildCareOverview.js';
import { loadWeeklySourceData } from '../../src/features/ai-report/loadWeeklySourceData.js';
import { buildSystemNotificationCandidates, medicationReminderText } from '../../src/features/notifications/buildNotificationCandidates.js';
import { createCareAdminClient, hasActiveCareAccess, reminderDedupeKey } from './_shared/careAccess.ts';
import { verifySupabaseUser } from './_shared/verifySupabaseUser.ts';

const readEnv = (key: string) => globalThis.Netlify?.env?.get?.(key) ?? process.env[key] ?? '';
const json = (value: unknown, status = 200) => Response.json(value, { status });
const tokenFrom = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
type Deps = { verifyUser: (token: string) => Promise<any>; admin: any; now: () => Date; hasAccess?: typeof hasActiveCareAccess };

async function userFor(request: Request, deps: Deps) {
  const token = tokenFrom(request);
  if (!token) return { user: null, response: json({ code: 'AUTH_REQUIRED' }, 401) };
  try {
    const user = await deps.verifyUser(token);
    return user?.id ? { user, response: null } : { user: null, response: json({ code: 'AUTH_REQUIRED' }, 401) };
  } catch { return { user: null, response: json({ code: 'AUTH_UNAVAILABLE' }, 503) }; }
}

async function remind(request: Request, deps: Deps) {
  const auth = await userFor(request, deps);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  const subjectUserId = body?.subjectUserId;
  if (!subjectUserId) return json({ code: 'CARE_SUBJECT_REQUIRED' }, 400);
  if (!(await (deps.hasAccess || hasActiveCareAccess)(deps.admin, auth.user.id, subjectUserId))) {
    return json({ code: 'CARE_ACCESS_DENIED' }, 403);
  }
  const now = deps.now();
  const dedupeKey = reminderDedupeKey(subjectUserId, now);
  const { error } = await deps.admin.from('notifications').insert({
    recipient_user_id: subjectUserId,
    actor_user_id: auth.user.id,
    type: 'caregiver_medication_reminder',
    dedupe_key: dedupeKey,
    title: '家人提醒你按时服药',
    body: medicationReminderText(),
    link: '/dashboard',
    created_at: now.toISOString(),
  });
  if (error?.code === '23505') return json({ code: 'NOTIFICATION_REMINDER_RATE_LIMITED' }, 429);
  if (error) return json({ code: 'NOTIFICATION_REMINDER_CREATE_FAILED' }, 503);
  return json({ status: 'sent' }, 201);
}

async function sync(request: Request, deps: Deps) {
  const auth = await userFor(request, deps);
  if (auth.response) return auth.response;
  try {
    const now = deps.now();
    const sourceData = await loadWeeklySourceData({ client: deps.admin, userId: auth.user.id, now });
    const candidates = buildSystemNotificationCandidates(buildCareOverview(sourceData, now));
    const candidateKeys = new Set(candidates.map((item) => item.dedupeKey));
    for (const item of candidates) {
      const { data: existing } = await deps.admin.from('notifications')
        .select('id, resolved_at').eq('recipient_user_id', auth.user.id).eq('dedupe_key', item.dedupeKey).maybeSingle();
      if (existing?.id) {
        const values = { title: item.title, body: item.body, link: item.link, resolved_at: null, ...(existing.resolved_at ? { read_at: null } : {}) };
        await deps.admin.from('notifications').update(values).eq('id', existing.id);
      } else {
        await deps.admin.from('notifications').insert({
          recipient_user_id: auth.user.id, type: item.type, dedupe_key: item.dedupeKey,
          title: item.title, body: item.body, link: item.link,
        });
      }
    }
    const { data: activeSystemNotifications, error: activeSystemError } = await deps.admin
      .from('notifications')
      .select('id, dedupe_key')
      .eq('recipient_user_id', auth.user.id)
      .in('type', ['low_stock', 'appointment_soon', 'record_pending'])
      .is('resolved_at', null);
    if (activeSystemError) throw activeSystemError;
    const resolvedIds = (activeSystemNotifications || [])
      .filter((item: { dedupe_key: string }) => !candidateKeys.has(item.dedupe_key))
      .map((item: { id: string }) => item.id);
    if (resolvedIds.length) {
      const { error } = await deps.admin.from('notifications')
        .update({ resolved_at: now.toISOString() })
        .in('id', resolvedIds)
        .eq('recipient_user_id', auth.user.id);
      if (error) throw error;
    }
    return json({ count: candidates.length });
  } catch { return json({ code: 'NOTIFICATION_SYNC_FAILED' }, 503); }
}

async function markRead(request: Request, deps: Deps) {
  const auth = await userFor(request, deps);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  let query = deps.admin.from('notifications').update({ read_at: deps.now().toISOString() }).eq('recipient_user_id', auth.user.id);
  if (Array.isArray(body?.ids) && body.ids.length) query = query.in('id', body.ids);
  const { error } = await query;
  return error ? json({ code: 'NOTIFICATION_READ_FAILED' }, 503) : json({ status: 'read' });
}

export async function handleNotificationRequest(request: Request, deps: Deps) {
  const pathname = new URL(request.url).pathname;
  if (request.method === 'POST' && pathname === '/api/notifications/remind') return remind(request, deps);
  if (request.method === 'POST' && pathname === '/api/notifications/sync') return sync(request, deps);
  if (request.method === 'POST' && pathname === '/api/notifications/read') return markRead(request, deps);
  return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
}

export default async (request: Request) => {
  const url = readEnv('SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
  const secret = readEnv('SUPABASE_SECRET_KEY') || readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secret) return json({ code: 'NOTIFICATIONS_NOT_CONFIGURED' }, 503);
  return handleNotificationRequest(request, { verifyUser: verifySupabaseUser, admin: createCareAdminClient(url, secret), now: () => new Date() });
};

export const config: Config = {
  path: ['/api/notifications/remind', '/api/notifications/sync', '/api/notifications/read'],
  method: ['POST'],
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
