import { requireSupabase } from '@/integrations/supabase/client';

const post = async (url, body = {}) => {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error('请先登录后再试');
  const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.code || '请求失败');
  return payload;
};

export const sendMedicationReminder = (subjectUserId) => post('/api/notifications/remind', { subjectUserId });
export const syncNotifications = () => post('/api/notifications/sync');
export const markNotificationsRead = (ids = []) => post('/api/notifications/read', { ids });

export const loadNotifications = async (userId) => {
  const { data, error } = await requireSupabase().from('notifications')
    .select('id, type, title, body, link, read_at, resolved_at, created_at')
    .eq('recipient_user_id', userId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
};
