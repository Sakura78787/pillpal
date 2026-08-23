import { requireSupabase } from '@/integrations/supabase/client';

const request = async (url, init = {}) => {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error('请先登录后再试');
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.code || '请求失败');
  return payload;
};

export const claimCareAuthorizations = () => request('/api/care/authorizations/claim', { method: 'POST' });
export const createCareAuthorization = (caregiverEmail) => request('/api/care/authorizations', { method: 'POST', body: JSON.stringify({ caregiverEmail }) });
export const revokeCareAuthorization = (id) => request(`/api/care/authorizations/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const getCareSubjects = () => request('/api/care/subjects');
export const getCareOverview = (subjectUserId) => request(`/api/care/overview?subject=${encodeURIComponent(subjectUserId)}`);

export const getOwnedCareAuthorizations = async (ownerUserId) => {
  const { data, error } = await requireSupabase().from('care_authorizations')
    .select('id, caregiver_email_normalized, status, created_at, activated_at')
    .eq('owner_user_id', ownerUserId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};
