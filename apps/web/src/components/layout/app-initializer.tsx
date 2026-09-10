'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';

export const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initAuth = useAuthStore((state) => state.initAuth);
  const router = useRouter();

  useEffect(() => {
    initAuth();

    const handleLogout = () => {
      useAuthStore.getState().logout();
      router.push('/login?expired=true');
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [initAuth, router]);

  return <>{children}</>;
};
