import { create } from 'zustand';
import { requireSupabase } from '@/integrations/supabase/client';
import { assertUserId, cleanMutationPayload, getErrorMessage } from '@/lib/onlineCrud';
import { toLocalDateKey } from '@/lib/dateTime';
import { guestDataGateway } from '@/features/guest-experience/guestData.js';
import { isGuestEntityId, isGuestUserId } from '@/features/guest-experience/guestSession.js';

const buildRecordPayload = (userId, recordData = {}) => {
  assertUserId(userId);
  return cleanMutationPayload({
    user_id: userId,
    record_type: recordData.record_type,
    values: recordData.values || {},
    recorded_at: recordData.recorded_at || new Date().toISOString(),
    note: recordData.note || '',
  });
};

const getTodayRecords = (records) => {
  const today = toLocalDateKey();
  return records.filter((record) => record.recorded_at && toLocalDateKey(record.recorded_at) === today);
};

export const useHealthStore = create((set, get) => ({
  records: [],
  todayRecords: [],
  isLoading: false,
  isSyncing: false,
  error: null,
  selectedRecord: null,

  loadLocalRecords: async (userId, recordType = null) => {
    if (!userId) return { success: false, error: '用户未登录' };

    set({ isLoading: true, error: null });
    try {
      if (isGuestUserId(userId)) {
        const data = guestDataGateway.list('healthRecords', (record) => !record.deleted_at && (!recordType || record.record_type === recordType));
        set({ records: data, todayRecords: getTodayRecords(data), isLoading: false });
        return { success: true, data, error: null };
      }
      const client = requireSupabase();
      let query = client
        .from('health_records')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (recordType) query = query.eq('record_type', recordType);

      const { data, error } = await query.order('recorded_at', { ascending: false });
      if (error) throw error;

      set({
        records: data || [],
        todayRecords: getTodayRecords(data || []),
        isLoading: false,
      });
      return { success: true, data: data || [], error: null };
    } catch (error) {
      const message = getErrorMessage(error, '加载健康记录失败');
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  syncFromCloud: async (userId, recordType = null, days = 30) => {
    if (!userId) return { success: false, error: '用户未登录' };

    set({ isSyncing: true, error: null });
    try {
      if (isGuestUserId(userId)) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const data = guestDataGateway.list('healthRecords', (record) =>
          !record.deleted_at && (!recordType || record.record_type === recordType) && new Date(record.recorded_at) >= cutoff
        );
        set({ records: data, todayRecords: getTodayRecords(data), isSyncing: false });
        return { success: true, data, error: null };
      }
      const client = requireSupabase();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = client
        .from('health_records')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('recorded_at', startDate.toISOString());

      if (recordType) query = query.eq('record_type', recordType);

      const { data, error } = await query.order('recorded_at', { ascending: false });
      if (error) throw error;

      set({
        records: data || [],
        todayRecords: getTodayRecords(data || []),
        isSyncing: false,
      });
      return { success: true, data: data || [], error: null };
    } catch (error) {
      const message = getErrorMessage(error, '同步健康记录失败');
      set({ error: message, isSyncing: false });
      return { success: false, error: message };
    }
  },

  addRecord: async (userId, recordData) => {
    set({ isLoading: true, error: null });

    try {
      const payload = buildRecordPayload(userId, recordData);
      if (isGuestUserId(userId)) {
        const result = guestDataGateway.create('healthRecords', payload);
        if (!result.success) throw new Error(result.error);
        const data = result.data;
        set((state) => {
          const records = [data, ...state.records];
          return { records, todayRecords: getTodayRecords(records), isLoading: false };
        });
        return { success: true, record: data, error: null };
      }
      const client = requireSupabase();
      const { data, error } = await client
        .from('health_records')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      set((state) => {
        const records = [data, ...state.records];
        return {
          records,
          todayRecords: getTodayRecords(records),
          isLoading: false,
        };
      });
      return { success: true, record: data, error: null };
    } catch (error) {
      const message = getErrorMessage(error, '添加健康记录失败，数据未保存');
      set({ error: message, isLoading: false });
      return { success: false, record: null, error: message };
    }
  },

  updateRecord: async (recordId, updates) => {
    set({ isLoading: true, error: null });

    try {
      const payload = cleanMutationPayload(updates);
      if (isGuestEntityId(recordId)) {
        const result = guestDataGateway.update('healthRecords', recordId, payload);
        if (!result.success) throw new Error(result.error);
        const data = result.data;
        set((state) => {
          const records = state.records.map((record) => String(record.id) === String(recordId) ? data : record);
          return { records, todayRecords: getTodayRecords(records), selectedRecord: data, isLoading: false };
        });
        return { success: true, record: data, error: null };
      }
      const client = requireSupabase();
      const { data, error } = await client
        .from('health_records')
        .update(payload)
        .eq('id', recordId)
        .select()
        .single();

      if (error) throw error;

      set((state) => {
        const records = state.records.map((record) =>
          String(record.id) === String(recordId) ? data : record
        );
        return {
          records,
          todayRecords: getTodayRecords(records),
          selectedRecord: data,
          isLoading: false,
        };
      });
      return { success: true, record: data, error: null };
    } catch (error) {
      const message = getErrorMessage(error, '更新健康记录失败，数据未保存');
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  deleteRecord: async (recordId) => {
    const result = await get().updateRecord(recordId, { deleted_at: new Date().toISOString() });
    if (result.success) {
      set((state) => {
        const records = state.records.filter((record) => String(record.id) !== String(recordId));
        return { records, todayRecords: getTodayRecords(records) };
      });
    }
    return result;
  },

  getLatestRecord: (recordType) => get().records.find((record) => record.record_type === recordType),
  getRecentRecords: (recordType, days = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return get().records
      .filter((record) => {
        if (recordType && record.record_type !== recordType) return false;
        return new Date(record.recorded_at) >= cutoffDate;
      })
      .slice(0, 20);
  },
  setSelectedRecord: (record) => set({ selectedRecord: record }),
  clearError: () => set({ error: null }),
}));
