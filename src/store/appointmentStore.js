import { create } from 'zustand';
import { requireSupabase } from '@/integrations/supabase/client';
import { assertUserId, cleanMutationPayload, getErrorMessage } from '@/lib/onlineCrud';
import { guestDataGateway } from '@/features/guest-experience/guestData.js';
import { isGuestEntityId, isGuestUserId } from '@/features/guest-experience/guestSession.js';

const buildAppointmentPayload = (userId, appointmentData = {}) => {
  assertUserId(userId);
  return cleanMutationPayload({
    user_id: userId,
    hospital_name: appointmentData.hospital_name,
    department: appointmentData.department,
    doctor_name: appointmentData.doctor_name || '',
    appointment_date: appointmentData.appointment_date,
    appointment_time: appointmentData.appointment_time || null,
    is_first_visit: Boolean(appointmentData.is_first_visit),
    status: appointmentData.status || 'scheduled',
    checkup_items: appointmentData.checkup_items || [],
    prescription: appointmentData.prescription || {},
    reminder_days: Number(appointmentData.reminder_days || 3),
    notes: appointmentData.notes || '',
  });
};

const sortAppointments = (appointments) => {
  return [...appointments].sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));
};

export const useAppointmentStore = create((set, get) => ({
  appointments: [],
  isLoading: false,
  isSyncing: false,
  error: null,
  selectedAppointment: null,

  loadLocalAppointments: async (userId) => {
    if (!userId) return { success: false, error: '用户未登录' };

    set({ isLoading: true, error: null });
    try {
      if (isGuestUserId(userId)) {
        const data = sortAppointments(guestDataGateway.list('appointments', (appointment) => !appointment.deleted_at));
        set({ appointments: data, isLoading: false });
        return { success: true, data, error: null };
      }
      const client = requireSupabase();
      const { data, error } = await client
        .from('appointments')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('appointment_date', { ascending: false });

      if (error) throw error;
      set({ appointments: data || [], isLoading: false });
      return { success: true, data: data || [], error: null };
    } catch (error) {
      const message = getErrorMessage(error, '加载复诊预约失败');
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  syncFromCloud: async (userId) => {
    set({ isSyncing: true });
    const result = await get().loadLocalAppointments(userId);
    set({ isSyncing: false });
    return result;
  },

  addAppointment: async (userId, appointmentData) => {
    set({ isLoading: true, error: null });

    try {
      const payload = buildAppointmentPayload(userId, appointmentData);
      if (isGuestUserId(userId)) {
        const result = guestDataGateway.create('appointments', payload);
        if (!result.success) throw new Error(result.error);
        const data = result.data;
        set((state) => ({ appointments: sortAppointments([data, ...state.appointments]), isLoading: false }));
        return { success: true, appointment: data, error: null };
      }
      const client = requireSupabase();
      const { data, error } = await client
        .from('appointments')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        appointments: sortAppointments([data, ...state.appointments]),
        isLoading: false,
      }));
      return { success: true, appointment: data, error: null };
    } catch (error) {
      const message = getErrorMessage(error, '添加复诊预约失败，数据未保存');
      set({ error: message, isLoading: false });
      return { success: false, appointment: null, error: message };
    }
  },

  updateAppointment: async (appointmentId, updates) => {
    set({ isLoading: true, error: null });

    try {
      const payload = cleanMutationPayload(updates);
      if (isGuestEntityId(appointmentId)) {
        const result = guestDataGateway.update('appointments', appointmentId, payload);
        if (!result.success) throw new Error(result.error);
        const data = result.data;
        set((state) => ({
          appointments: sortAppointments(state.appointments.map((appointment) => String(appointment.id) === String(appointmentId) ? data : appointment)),
          selectedAppointment: data,
          isLoading: false,
        }));
        return { success: true, appointment: data, error: null };
      }
      const client = requireSupabase();
      const { data, error } = await client
        .from('appointments')
        .update(payload)
        .eq('id', appointmentId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        appointments: sortAppointments(
          state.appointments.map((appointment) =>
            String(appointment.id) === String(appointmentId) ? data : appointment
          )
        ),
        selectedAppointment: data,
        isLoading: false,
      }));
      return { success: true, appointment: data, error: null };
    } catch (error) {
      const message = getErrorMessage(error, '更新复诊预约失败，数据未保存');
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  completeAppointment: async (appointmentId, completionData = {}) => {
    return get().updateAppointment(appointmentId, {
      status: 'completed',
      ...completionData,
    });
  },

  cancelAppointment: async (appointmentId, reason = '') => {
    return get().updateAppointment(appointmentId, {
      status: 'cancelled',
      notes: reason,
    });
  },

  deleteAppointment: async (appointmentId) => {
    const result = await get().updateAppointment(appointmentId, { deleted_at: new Date().toISOString() });
    if (result.success) {
      set((state) => ({
        appointments: state.appointments.filter((appointment) => String(appointment.id) !== String(appointmentId)),
      }));
    }
    return result;
  },

  getAppointmentById: async (appointmentId) => {
    const cached = get().appointments.find((item) => String(item.id) === String(appointmentId));
    if (cached) {
      set({ selectedAppointment: cached });
      return cached;
    }

    try {
      if (isGuestEntityId(appointmentId)) {
        const data = guestDataGateway.list('appointments', (item) => String(item.id) === String(appointmentId))[0] || null;
        set({ selectedAppointment: data });
        return data;
      }
      const client = requireSupabase();
      const { data, error } = await client
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      set({ selectedAppointment: data });
      return data;
    } catch (error) {
      set({ error: getErrorMessage(error, '获取复诊预约失败') });
      return null;
    }
  },

  getUpcomingAppointments: (days = 7) => {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    return get().appointments
      .filter((appointment) => {
        if (appointment.status !== 'scheduled') return false;
        const appointmentDate = new Date(appointment.appointment_date);
        return appointmentDate >= today && appointmentDate <= futureDate;
      })
      .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
  },

  setSelectedAppointment: (appointment) => set({ selectedAppointment: appointment }),
  clearError: () => set({ error: null }),
}));
