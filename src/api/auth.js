import { requireSupabase } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/lib/onlineCrud';

const getAuthRedirectUrl = () => {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/auth/callback`;
};

export const sendMagicLink = async (email) => {
  try {
    const client = requireSupabase();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        shouldCreateUser: true,
      },
    });

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, '登录邮件发送失败，请稍后重试'),
    };
  }
};

export const getCurrentUser = async () => {
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: getErrorMessage(error, '获取用户信息失败') };
  }
};

export const getSession = async () => {
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return { session: data.session, error: null };
  } catch (error) {
    return { session: null, error: getErrorMessage(error, '获取会话失败') };
  }
};

export const signOut = async () => {
  try {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, '退出登录失败') };
  }
};

export const onAuthStateChange = (callback) => {
  const client = requireSupabase();
  const { data } = client.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return () => data.subscription.unsubscribe();
};

export const getProfile = async (userId) => {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return { profile: data, error: null };
  } catch (error) {
    return { profile: null, error: getErrorMessage(error, '获取用户档案失败') };
  }
};

export const updateProfile = async (userId, updates) => {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return { profile: data, error: null };
  } catch (error) {
    return { profile: null, error: getErrorMessage(error, '更新用户档案失败') };
  }
};
