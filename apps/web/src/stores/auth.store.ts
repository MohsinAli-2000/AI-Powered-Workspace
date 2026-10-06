import { create } from 'zustand';
import { AuthSession, User } from '@/types/api.types';
import { apiClient, getStoredSession, setStoredSession } from '@/lib/api-client';
import { normalizeDeep } from '@/lib/normalize';
import { useOrgStore } from '@/stores/org.store';

interface AuthState {
  session: AuthSession | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (session: AuthSession | null) => void;
  updateUser: (user: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setSession: (session: AuthSession | null) => {
    setStoredSession(session);
    set({
      session,
      user: session?.user || null,
      isAuthenticated: !!session?.access_token,
      isLoading: false,
    });
  },

  updateUser: (updatedFields: Partial<User>) => {
    const current = get().user;
    if (!current) return;
    const updatedUser = { ...current, ...updatedFields };
    const currentSession = get().session;
    if (currentSession) {
      const updatedSession = { ...currentSession, user: updatedUser };
      setStoredSession(updatedSession);
      set({ user: updatedUser, session: updatedSession });
    } else {
      set({ user: updatedUser });
    }
  },

  /** Re-reads the profile from the API (e.g. to pick up a completed email verification). */
  refreshUser: async () => {
    if (!get().isAuthenticated) return;
    try {
      const res = await apiClient<{ user?: User }>('/auth/me');
      if (res?.user) get().updateUser(res.user);
    } catch {
      // Non-fatal: the cached profile stays in place.
    }
  },

  logout: () => {
    setStoredSession(null);
    // Drop tenant state so the next user in this tab never sees the previous org's data.
    useOrgStore.getState().resetAll();
    set({
      session: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  initAuth: () => {
    const stored = getStoredSession();
    if (stored?.access_token) {
      set({
        session: stored,
        // Sessions stored before the API adapter existed lack `full_name` / `is_verified`.
        user: stored.user ? normalizeDeep(stored.user) : null,
        isAuthenticated: true,
        isLoading: false,
      });
      void get().refreshUser();
    } else {
      set({
        session: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
