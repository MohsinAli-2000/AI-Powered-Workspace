'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { useRouter } from 'next/navigation';

export const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initAuth = useAuthStore((state) => state.initAuth);
  const initTheme = useThemeStore((state) => state.initTheme);
  const router = useRouter();

  useEffect(() => {
    initTheme();
    initAuth();

    const handleLogout = () => {
      useAuthStore.getState().logout();
      router.push('/login?expired=true');
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [initAuth, initTheme, router]);

  return <>{children}</>;
};
