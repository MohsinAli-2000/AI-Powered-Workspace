'use client';

import React, { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/theme.store';
import { Sun, Moon, Monitor } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Avoid SSR hydration mismatch
    return (
      <div
        className={`w-9 h-9 rounded-xl border border-white/10 bg-slate-900/60 flex items-center justify-center opacity-70 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative p-2 rounded-xl border border-white/10 bg-slate-900/70 hover:bg-slate-800 hover:border-indigo-500/30 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-2 group ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-300 transition-transform duration-300 rotate-0 group-hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-500 transition-transform duration-300 -rotate-12 group-hover:rotate-0" />
        )}
      </div>

      {showLabel && (
        <span className="text-xs font-medium text-slate-300 group-hover:text-white">
          {isDark ? 'Light mode' : 'Dark mode'}
        </span>
      )}
    </button>
  );
};
