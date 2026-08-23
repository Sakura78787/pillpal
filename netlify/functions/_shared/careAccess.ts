import { createClient } from '@supabase/supabase-js';

export const normalizeCaregiverEmail = (value: string) => value.trim().toLowerCase();

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function canCreateAuthorization({ ownerEmail, caregiverEmail }: { ownerEmail?: string; caregiverEmail?: string }) {
  const normalized = normalizeCaregiverEmail(caregiverEmail || '');
  if (!isEmail(normalized)) return { ok: false, code: 'CARE_AUTHORIZATION_INVALID_EMAIL' };
  if (normalized === normalizeCaregiverEmail(ownerEmail || '')) {
    return { ok: false, code: 'CARE_AUTHORIZATION_SELF_NOT_ALLOWED' };
  }
  return { ok: true, email: normalized };
}

export const reminderDedupeKey = (recipientUserId: string, now = new Date()) => {
  const hour = String(Math.floor(now.getUTCHours() / 4) * 4).padStart(2, '0');
  return `caregiver_medication_reminder:${recipientUserId}:${now.toISOString().slice(0, 10)}T${hour}`;
};

export const hasActiveCareAccess = async (admin: any, caregiverUserId: string, ownerUserId: string) => {
  if (caregiverUserId === ownerUserId) return true;
  const { data, error } = await admin
    .from('care_authorizations')
    .select('id')
    .eq('owner_user_id', ownerUserId)
    .eq('caregiver_user_id', caregiverUserId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
};

export const createCareAdminClient = (url: string, secret: string) => createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
