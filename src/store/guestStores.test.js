import { afterEach, describe, expect, test, vi } from 'vitest';
const requireSupabase = vi.hoisted(() => vi.fn(() => {
  throw new Error('访客操作不应请求 Supabase');
}));

vi.mock('@/integrations/supabase/client', () => ({ requireSupabase }));
import { GUEST_USER_ID, guestSessionRepository } from '@/features/guest-experience/guestSession.js';
import { useAppointmentStore } from './appointmentStore.js';
import { useHealthStore } from './healthStore.js';
import { useLogStore } from './logStore.js';
import { useMedicationStore } from './medicationStore.js';

const resetStores = () => {
  requireSupabase.mockClear();
  guestSessionRepository.reset();
  useMedicationStore.setState({ medications: [], selectedMedication: null, error: null });
  useLogStore.setState({ logs: [], todayLogs: [], error: null });
  useHealthStore.setState({ records: [], todayRecords: [], selectedRecord: null, error: null });
  useAppointmentStore.setState({ appointments: [], selectedAppointment: null, error: null });
};

afterEach(resetStores);

describe('guest domain stores', () => {
  test('keeps medication CRUD and stock adjustment inside the guest session', async () => {
    const medications = useMedicationStore.getState();
    await medications.loadLocalMedications(GUEST_USER_ID);

    const added = await medications.addMedication(GUEST_USER_ID, {
      name: '访客新增药物', dosage: '2', stock_quantity: 3, reminder_times: ['09:00'],
    });
    expect(added).toMatchObject({ success: true, medication: { is_guest: true, is_demo: false } });

    const deduction = await useMedicationStore.getState().deductStock(added.medication.id, 1);
    expect(deduction).toMatchObject({ success: true, medication: { stock_quantity: 2 } });

    await useMedicationStore.getState().deleteMedication(added.medication.id);
    expect(guestSessionRepository.read().session.medications.find((item) => item.id === added.medication.id))
      .toMatchObject({ status: 'deleted' });
    expect(requireSupabase).not.toHaveBeenCalled();
  });

  test('prevents duplicate guest check-ins and persists skip records without Supabase', async () => {
    const medicationId = guestSessionRepository.read().session.medications[0].id;
    const today = new Date().toLocaleDateString('en-CA');
    const logs = useLogStore.getState();
    const checkIn = await logs.checkIn(GUEST_USER_ID, medicationId, { scheduled_date: today, scheduled_time: '12:34' });
    const duplicate = await useLogStore.getState().checkIn(GUEST_USER_ID, medicationId, { scheduled_date: today, scheduled_time: '12:34' });
    const skipped = await useLogStore.getState().skipMedication(GUEST_USER_ID, medicationId, { scheduled_date: today, scheduled_time: '12:35', reason: '访客跳过' });

    expect(checkIn).toMatchObject({ success: true, log: { is_guest: true, status: 'taken' } });
    expect(duplicate).toMatchObject({ success: false, error: '该时段已经打卡过了' });
    expect(skipped).toMatchObject({ success: true, log: { is_guest: true, status: 'skipped' } });
    expect(requireSupabase).not.toHaveBeenCalled();
  });

  test('persists guest health records and appointments without an online account', async () => {
    const record = await useHealthStore.getState().addRecord(GUEST_USER_ID, {
      record_type: 'weight', values: { value: 64.8 }, note: '访客记录',
    });
    const appointment = await useAppointmentStore.getState().addAppointment(GUEST_USER_ID, {
      hospital_name: '访客医院', department: '内科', appointment_date: '2026-09-10',
    });

    expect(record).toMatchObject({ success: true, record: { is_guest: true, note: '访客记录' } });
    expect(appointment).toMatchObject({ success: true, appointment: { is_guest: true, hospital_name: '访客医院' } });
    expect(requireSupabase).not.toHaveBeenCalled();
  });
});
