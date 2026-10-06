'use client';

import React from 'react';
import Link from 'next/link';
import { OrgSwitcher } from './org-switcher';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';
import { useUiStore } from '@/stores/ui.store';
import { Sparkles, Menu } from 'lucide-react';

export const Navbar: React.FC = () => {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <header className="h-16 shrink-0 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl z-30 px-3 sm:px-6 flex items-center justify-between gap-2">
      {/* Brand & Context */}
      <div className="flex items-center gap-2 sm:gap-6 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-100 hidden md:inline-block">
            AI Knowledge Workspace
          </span>
        </Link>

        {/* Vertical divider */}
        <div className="h-5 w-px bg-white/10 hidden sm:block" />

        {/* Organization Switcher */}
        <OrgSwitcher />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3 shrink-0">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};
