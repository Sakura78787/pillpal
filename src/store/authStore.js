import { create } from 'zustand';
import {
  getCurrentUser,
  getProfile,
  getSession,
  onAuthStateChange,
  signOut,
  updateProfile,
} from '@/api/auth';
import { AuthStatus } from '@/types/auth';
import { clearAllWeeklyReportJobs } from '@/features/ai-report/jobStorage';
import {
  GUEST_USER_ID,
  guestSessionRepository,
} from '@/features/guest-experience/guestSession';
import { clearGuestDomainState, loadGuestDomainState } from '@/features/guest-experience/guestRuntime';

const guestUser = {
  id: GUEST_USER_ID,
  email: null,
  username: '访客',
};

export const useAuthStore = create((set) => ({
  authStatus: AuthStatus.AUTHENTICATING,
  user: null,
  profile: null,
  session: null,
  isLoading: false,
  error: null,

  initializeAuth: async () => {
    set({ authStatus: AuthStatus.AUTHENTICATING, isLoading: true, error: null });

    try {
      const { session, error: sessionError } = await getSession();
      if (sessionError || !session) {
        const guestResult = useAuthStore.getState().restoreGuestSession();
        if (guestResult.success) return;
        set({
          authStatus: AuthStatus.UNAUTHENTICATED,
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          error: sessionError || null,
        });
        return;
      }

      const { user, error: userError } = await getCurrentUser();
      if (userError || !user) {
        set({
          authStatus: AuthStatus.UNAUTHENTICATED,
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          error: userError || null,
        });
        return;
      }

      const { profile, error: profileError } = await getProfile(user.id);
      guestSessionRepository.clear();
      clearGuestDomainState();
      set({
        authStatus: AuthStatus.AUTHENTICATED,
        user,
        profile,
        session,
        isLoading: false,
        error: profileError || null,
      });
    } catch (error) {
      set({
        authStatus: AuthStatus.ERROR,
        user: null,
        profile: null,
        session: null,
        isLoading: false,
        error: error.message,
      });
    }
  },

  setAuthenticated: async (user, session, profile = null) => {
    const currentProfile = profile || (user?.id ? (await getProfile(user.id)).profile : null);
    guestSessionRepository.clear();
    clearGuestDomainState();
    set({
      authStatus: AuthStatus.AUTHENTICATED,
      user,
      session,
      profile: currentProfile,
      error: null,
    });
  },

  updateUserProfile: async (updates) => {
    const state = useAuthStore.getState();
    if (state.authStatus === AuthStatus.GUEST) return { success: false, error: '访客体验不保存个人资料，请登录后再操作。' };
    if (!state.user?.id) return { success: false, error: '用户未登录' };

    set({ isLoading: true, error: null });
    const { profile, error } = await updateProfile(state.user.id, updates);

    set({
      profile: profile || state.profile,
      isLoading: false,
      error,
    });

    return { success: !error, error };
  },

  logout: async () => {
    if (useAuthStore.getState().authStatus === AuthStatus.GUEST) {
      return useAuthStore.getState().exitGuestSession();
    }
    set({ isLoading: true, error: null });
    const { success, error } = await signOut();

    if (success) {
      clearAllWeeklyReportJobs();
      set({
        authStatus: AuthStatus.UNAUTHENTICATED,
        user: null,
        profile: null,
        session: null,
        isLoading: false,
        error: null,
      });
    } else {
      set({ isLoading: false, error });
    }

    return { success, error };
  },

  startGuestSession: () => {
    const { session, persistence, recovered } = guestSessionRepository.read();
    loadGuestDomainState(session);
    set({
      authStatus: AuthStatus.GUEST,
      user: guestUser,
      profile: null,
      session: null,
      isLoading: false,
      error: null,
    });
    return { success: true, persistence, recovered };
  },

  restoreGuestSession: () => {
    if (!guestSessionRepository.hasSession()) return { success: false };
    return useAuthStore.getState().startGuestSession();
  },

  resetGuestSession: () => {
    const result = guestSessionRepository.reset();
    if (result.success) loadGuestDomainState(result.session);
    return { success: result.success, session: result.session, persistence: result.persistence };
  },

  exitGuestSession: () => {
    guestSessionRepository.clear();
    clearGuestDomainState();
    clearAllWeeklyReportJobs();
    set({
      authStatus: AuthStatus.UNAUTHENTICATED,
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      error: null,
    });
    return { success: true };
  },

  clearError: () => set({ error: null }),

  subscribeToAuthChanges: () => {
    try {
      return onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          guestSessionRepository.clear();
          clearGuestDomainState();
          const { profile } = await getProfile(session.user.id);
          set({
            authStatus: AuthStatus.AUTHENTICATED,
            user: session.user,
            profile,
            session,
            error: null,
          });
        }

        if (event === 'SIGNED_OUT' && useAuthStore.getState().authStatus !== AuthStatus.GUEST) {
          clearAllWeeklyReportJobs();
          set({
            authStatus: AuthStatus.UNAUTHENTICATED,
            user: null,
            profile: null,
            session: null,
          });
        }
      });
    } catch (error) {
      if (useAuthStore.getState().authStatus !== AuthStatus.GUEST) {
        set({ authStatus: AuthStatus.ERROR, error: error.message });
      }
      return () => {};
    }
  },
}));
