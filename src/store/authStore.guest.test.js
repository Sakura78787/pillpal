import { afterEach, describe, expect, test } from 'vitest';
import { GUEST_USER_ID, guestSessionRepository } from '@/features/guest-experience/guestSession.js';
import { AuthStatus } from '@/types/auth.js';
import { useAuthStore } from './authStore.js';

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
});
