import { afterEach, describe, expect, test } from 'vitest';
import { GUEST_USER_ID, guestSessionRepository } from '@/features/guest-experience/guestSession.js';
import { AuthStatus } from '@/types/auth.js';
import { useAppointmentStore } from './appointmentStore.js';
import { useAuthStore } from './authStore.js';
import { useHealthStore } from './healthStore.js';
import { useLogStore } from './logStore.js';
import { useMedicationStore } from './medicationStore.js';

const resetAuthStore = () => {
  useAuthStore.setState({
    authStatus: AuthStatus.UNAUTHENTICATED,
    user: null,
    profile: null,
    session: null,
    isLoading: false,
    error: null,
  });
  guestSessionRepository.clear();
  useMedicationStore.setState({ medications: [], selectedMedication: null });
  useLogStore.setState({ logs: [], todayLogs: [] });
  useHealthStore.setState({ records: [], todayRecords: [], selectedRecord: null });
  useAppointmentStore.setState({ appointments: [], selectedAppointment: null });
};

afterEach(resetAuthStore);

describe('guest authentication state', () => {
  test('starts an explicit guest session without creating a Supabase session', () => {
    const result = useAuthStore.getState().startGuestSession();
    const state = useAuthStore.getState();

    expect(result.success).toBe(true);
    expect(state.authStatus).toBe(AuthStatus.GUEST);
    expect(state.user).toMatchObject({ id: GUEST_USER_ID, username: '访客' });
    expect(state.session).toBeNull();
  });

  test('exits a guest session and clears its temporary business data', () => {
    useAuthStore.getState().startGuestSession();
    const result = useAuthStore.getState().exitGuestSession();

    expect(result.success).toBe(true);
    expect(useAuthStore.getState().authStatus).toBe(AuthStatus.UNAUTHENTICATED);
    expect(guestSessionRepository.hasSession()).toBe(false);
  });

  test('clears all guest data before accepting an authenticated account', async () => {
    useAuthStore.getState().startGuestSession();
    useMedicationStore.setState({ medications: [{ id: 'guest-medication-local' }] });
    useLogStore.setState({ logs: [{ id: 'guest-log-local' }] });
    useHealthStore.setState({ records: [{ id: 'guest-health-local' }] });
    useAppointmentStore.setState({ appointments: [{ id: 'guest-appointment-local' }] });

    await useAuthStore.getState().setAuthenticated(
      { id: 'cloud-user', email: 'user@example.com' },
      { access_token: 'test-session' },
      { id: 'cloud-user' },
    );

    expect(useAuthStore.getState()).toMatchObject({ authStatus: AuthStatus.AUTHENTICATED, user: { id: 'cloud-user' } });
    expect(guestSessionRepository.hasSession()).toBe(false);
    expect(useMedicationStore.getState().medications).toEqual([]);
    expect(useLogStore.getState().logs).toEqual([]);
    expect(useHealthStore.getState().records).toEqual([]);
    expect(useAppointmentStore.getState().appointments).toEqual([]);
  });
});
