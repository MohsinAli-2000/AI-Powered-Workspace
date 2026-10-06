'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { LogOut, User, Shield, ChevronDown, HelpCircle } from 'lucide-react';

export const UserMenu: React.FC = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      // Best-effort server-side logout; the local session is cleared regardless.
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    logout();
    router.push('/login');
  };

  if (!user) return null;

  const displayName = user.full_name || user.email;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2.5 p-1.5 rounded-xl border border-white/10 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800 transition-all cursor-pointer"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
          {initials}
        </div>
        <div className="hidden md:block text-left pr-1">
          <p className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
            {user.full_name || 'User'}
          </p>
          <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{user.email}</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-1.5 shadow-2xl z-40"
          >
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-xs font-semibold text-slate-100 truncate">{user.full_name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              {user.is_verified ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 mt-1">
                  <Shield className="w-3 h-3" /> Verified Account
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 mt-1">
                  Verification Pending
                </span>
              )}
            </div>

            <div className="py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  router.push('/settings/account');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>My Account</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  router.push('/help');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Help &amp; Roles</span>
              </button>
            </div>

            <div className="pt-1 border-t border-white/5">
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
