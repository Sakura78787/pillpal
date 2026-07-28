import { create } from 'zustand';
import { requireSupabase } from '@/integrations/supabase/client';
import { assertUserId, cleanMutationPayload, getErrorMessage } from '@/lib/onlineCrud';

const getDateString = () => new Date().toISOString().split('T')[0];
const getTimeString = () => new Date().toTimeString().slice(0, 8);

const buildLogPayload = (userId, medicationId, data = {}, status = 'taken') => {
  assertUserId(userId);
  return cleanMutationPayload({
    medication_id: medicationId,
    user_id: userId,
    scheduled_date: data.scheduled_date || getDateString(),
    scheduled_time: data.scheduled_time || getTimeString(),
    taken_at: status === 'taken' ? data.taken_at || new Date().toISOString() : null,
    status,
    skip_reason: data.reason || data.skip_reason || null,
    feeling_score: data.feeling_score || null,
    note: data.note || '',
  });
};

export const useLogStore = create((set, get) => ({
  logs: [],
  todayLogs: [],
  isLoading: false,
  isSyncing: false,
  error: null,
  selectedDate: getDateString(),

  loadLocalLogs: async (userId, date = null) => {
    if (!userId) return { success: false, error: '用户未登录' };

    set({ isLoading: true, error: null });
    try {
      const targetDate = date || get().selectedDate;
      const client = requireSupabase();
      const { data, error } = await client
        .from('medication_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', targetDate)
        .is('deleted_at', null)
        .order('scheduled_time', { ascending: true });

      if (error) throw error;

      const nextState = { logs: data || [], isLoading: false };
      if (targetDate === getDateString()) nextState.todayLogs = data || [];
      if (date) nextState.selectedDate = targetDate;
      set(nextState);
      return { success: true, data: data || [], error: null };
    } catch (error) {
      const message = getErrorMessage(error, '加载服药记录失败');
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  syncFromCloud: async (userId, startDate = null, endDate = null) => {
    if (!userId) return { success: false, error: '用户未登录' };

    set({ isSyncing: true, error: null });
    try {
      const client = requireSupabase();
      let query = client
        .from('medication_logs')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (startDate) query = query.gte('scheduled_date', startDate);
      if (endDate) query = query.lte('scheduled_date', endDate);

      const { data, error } = await query.order('scheduled_date', { ascending: false });
      if (error) throw error;

      const todayLogs = (data || []).filter((log) => log.scheduled_date === getDateString());
      set({ logs: data || [], todayLogs, isSyncing: false });
      return { success: true, data: data || [], error: null };
    } catch (error) {
      const message = getErrorMessage(error, '同步服药记录失败');
      set({ error: message, isSyncing: false });
      return { success: false, error: message };
    }
  },

  checkIn: async (userId, medicationId, checkInData = {}) => {
    set({ isLoading: true, error: null });

    try {
      const client = requireSupabase();
      const payload = buildLogPayload(userId, medicationId, checkInData, 'taken');

      const { data: existing, error: duplicateError } = await client
        .from('medication_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('medication_id', medicationId)
        .eq('scheduled_date', payload.scheduled_date)
        .eq('scheduled_time', payload.scheduled_time)
        .eq('status', 'taken')
        .is('deleted_at', null)
        .maybeSingle();

      if (duplicateError) throw duplicateError;
      if (existing) {
        set({ isLoading: false });
        return { success: false, error: '该时段已经打卡过了', log: existing };
      }

      const { data, error } = await client
        .from('medication_logs')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        logs: [data, ...state.logs],
        todayLogs: data.scheduled_date === getDateString() ? [data, ...state.todayLogs] : state.todayLogs,
        isLoading: false,
      }));

      return { success: true, log: data, error: null };
    } catch (error) {
      const message = getErrorMessage(error, '打卡失败，数据未保存');
      set({ error: message, isLoading: false });
      return { success: false, log: null, error: message };
    }
  },

  skipMedication: async (userId, medicationId, skipData = {}) => {
    set({ isLoading: true, error: null });

    try {
      const client = requireSupabase();
      const payload = buildLogPayload(userId, medicationId, skipData, 'skipped');
      const { data, error } = await client
        .from('medication_logs')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        logs: [data, ...state.logs],
        todayLogs: data.scheduled_date === getDateString() ? [data, ...state.todayLogs] : state.todayLogs,
        isLoading: false,
      }));

      return { success: true, log: data, error: null };
    } catch (error) {
      const message = getErrorMessage(error, '操作失败，数据未保存');
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  updateLog: async (logId, updates) => {
    try {
      const client = requireSupabase();
      const payload = cleanMutationPayload(updates);
      const { data, error } = await client
        .from('medication_logs')
        .update(payload)
        .eq('id', logId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        logs: state.logs.map((log) => (String(log.id) === String(logId) ? data : log)),
        todayLogs: state.todayLogs.map((log) => (String(log.id) === String(logId) ? data : log)),
      }));
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, '更新记录失败') };
    }
  },

  deleteLog: async (logId) => {
    const deletedAt = new Date().toISOString();
    const result = await get().updateLog(logId, { deleted_at: deletedAt });
    if (result.success) {
      set((state) => ({
        logs: state.logs.filter((log) => String(log.id) !== String(logId)),
        todayLogs: state.todayLogs.filter((log) => String(log.id) !== String(logId)),
      }));
    }
    return result;
  },

  setSelectedDate: (date) => set({ selectedDate: date }),
  getTodayStats: () => {
    const { todayLogs } = get();
    const total = todayLogs.length;
    const taken = todayLogs.filter((log) => log.status === 'taken').length;
    const skipped = todayLogs.filter((log) => log.status === 'skipped').length;
    return {
      total,
      taken,
      skipped,
      pending: total - taken - skipped,
      completionRate: total > 0 ? Math.round((taken / total) * 100) : 0,
    };
  },
  clearError: () => set({ error: null }),
}));
