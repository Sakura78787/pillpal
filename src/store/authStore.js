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
    set({ isLoading: true, error: null });
    const { success, error } = await signOut();

    if (success) {
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

  clearError: () => set({ error: null }),

  subscribeToAuthChanges: () => {
    try {
      return onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { profile } = await getProfile(session.user.id);
          set({
            authStatus: AuthStatus.AUTHENTICATED,
            user: session.user,
            profile,
            session,
            error: null,
          });
        }

        if (event === 'SIGNED_OUT') {
          set({
            authStatus: AuthStatus.UNAUTHENTICATED,
            user: null,
            profile: null,
            session: null,
          });
        }
      });
    } catch (error) {
      set({ authStatus: AuthStatus.ERROR, error: error.message });
      return () => {};
    }
  },
}));
