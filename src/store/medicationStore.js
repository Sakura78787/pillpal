import { create } from 'zustand';
import { requireSupabase } from '@/integrations/supabase/client';
import { assertUserId, cleanMutationPayload, getErrorMessage, todayString } from '@/lib/onlineCrud';
import { guestDataGateway } from '@/features/guest-experience/guestData.js';
import { isGuestEntityId, isGuestUserId } from '@/features/guest-experience/guestSession.js';

const buildMedicationPayload = (userId, medicationData = {}) => {
  assertUserId(userId);
  const reminderTimes = medicationData.reminder_times?.length
    ? medicationData.reminder_times
    : ['08:00'];

  return cleanMutationPayload({
    user_id: userId,
    name: medicationData.name,
    dosage: medicationData.dosage || '',
    unit: medicationData.unit || '片',
    frequency_type: medicationData.frequency_type || 'daily',
    frequency_config: medicationData.frequency_config || {},
    meal_timing: medicationData.meal_timing || 'anytime',
    reminder_times: reminderTimes,
    start_date: medicationData.start_date || todayString(),
    end_date: medicationData.end_date || null,
    stock_quantity: Number(medicationData.stock_quantity || 0),
    stock_unit: medicationData.stock_unit || medicationData.unit || '片',
    low_stock_threshold: Number(medicationData.low_stock_threshold || 7),
    status: medicationData.status || 'active',
    notes: medicationData.notes || '',
  });
};

export const useMedicationStore = create((set, get) => ({
  medications: [],
  isLoading: false,
  isSyncing: false,
  error: null,
  selectedMedication: null,

  loadLocalMedications: async (userId) => {
    if (!userId) return { success: false, error: '用户未登录' };

    set({ isLoading: true, error: null });
    try {
      if (isGuestUserId(userId)) {
        const data = guestDataGateway.list('medications').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        set({ medications: data, isLoading: false });
        return { success: true, data, error: null };
      }
      const client = requireSupabase();
      const { data, error } = await client
        .from('medications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ medications: data || [], isLoading: false });
      return { success: true, data: data || [], error: null };
    } catch (error) {
      const message = getErrorMessage(error, '加载用药计划失败');
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  syncFromCloud: async (userId) => {
    set({ isSyncing: true });
    const result = await get().loadLocalMedications(userId);
    set({ isSyncing: false });
    return result;
  },

  addMedication: async (userId, medicationData) => {
    set({ isLoading: true, error: null });

    try {
      const payload = buildMedicationPayload(userId, medicationData);
      if (isGuestUserId(userId)) {
        const result = guestDataGateway.create('medications', payload);
        if (!result.success) throw new Error(result.error);
        const data = result.data;
        set((state) => ({ medications: [data, ...state.medications], isLoading: false }));
        return { success: true, medication: data, error: null };
      }
      const client = requireSupabase();
      const { data, error } = await client
        .from('medications')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        medications: [data, ...state.medications],
        isLoading: false,
      }));

      return { success: true, medication: data, error: null };
    } catch (error) {
      const message = getErrorMessage(error, '添加用药计划失败，数据未保存');
      set({ error: message, isLoading: false });
      return { success: false, medication: null, error: message };
    }
  },

  updateMedication: async (medicationId, updates) => {
    set({ isLoading: true, error: null });

    try {
      const payload = cleanMutationPayload(updates);
      if (isGuestEntityId(medicationId)) {
        const result = guestDataGateway.update('medications', medicationId, payload);
        if (!result.success) throw new Error(result.error);
        const data = result.data;
        set((state) => ({
          medications: state.medications.map((medication) => String(medication.id) === String(medicationId) ? data : medication),
          selectedMedication: data,
          isLoading: false,
        }));
        return { success: true, medication: data, error: null };
      }
      const client = requireSupabase();
      const { data, error } = await client
        .from('medications')
        .update(payload)
        .eq('id', medicationId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        medications: state.medications.map((medication) =>
          String(medication.id) === String(medicationId) ? data : medication
        ),
        selectedMedication: data,
        isLoading: false,
      }));

      return { success: true, medication: data, error: null };
    } catch (error) {
      const message = getErrorMessage(error, '更新用药计划失败，数据未保存');
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  deleteMedication: async (medicationId) => {
    return get().updateMedication(medicationId, {
      status: 'deleted',
      deleted_at: new Date().toISOString(),
    });
  },

  restoreMedication: async (medicationId) => {
    const medication = get().medications.find((item) => String(item.id) === String(medicationId));
    if (medication?.deleted_at) {
      const deletedTime = new Date(medication.deleted_at).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - deletedTime > sevenDays) {
        return { success: false, error: '已超过7天恢复期限' };
      }
    }

    return get().updateMedication(medicationId, {
      status: 'active',
      deleted_at: null,
    });
  },

  getMedicationById: async (medicationId) => {
    const cached = get().medications.find((item) => String(item.id) === String(medicationId));
    if (cached) {
      set({ selectedMedication: cached });
      return cached;
    }

    try {
      if (isGuestEntityId(medicationId)) {
        const data = guestDataGateway.list('medications', (item) => String(item.id) === String(medicationId))[0] || null;
        set({ selectedMedication: data });
        return data;
      }
      const client = requireSupabase();
      const { data, error } = await client
        .from('medications')
        .select('*')
        .eq('id', medicationId)
        .single();

      if (error) throw error;
      set({ selectedMedication: data });
      return data;
    } catch (error) {
      set({ error: getErrorMessage(error, '获取用药计划失败') });
      return null;
    }
  },

  deductStock: async (medicationId, amount = 1) => {
    const medication = get().medications.find((item) => String(item.id) === String(medicationId));
    if (!medication) return { success: false, error: '用药计划不存在' };

    const newStock = Math.max(0, Number(medication.stock_quantity || 0) - amount);
    return get().updateMedication(medicationId, { stock_quantity: newStock });
  },

  setSelectedMedication: (medication) => set({ selectedMedication: medication }),
  clearError: () => set({ error: null }),
}));
