import { create } from 'zustand';
import { AuthSession, User } from '@/types/api.types';
import { getStoredSession, setStoredSession } from '@/lib/api-client';

interface AuthState {
  session: AuthSession | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (session: AuthSession | null) => void;
  updateUser: (user: Partial<User>) => void;
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

  logout: () => {
    setStoredSession(null);
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
        user: stored.user,
        isAuthenticated: true,
        isLoading: false,
      });
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
