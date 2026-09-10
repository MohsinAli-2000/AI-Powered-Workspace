'use client';

import React from 'react';
import Link from 'next/link';
import { OrgSwitcher } from './org-switcher';
import { UserMenu } from './user-menu';
import { Sparkles, Terminal } from 'lucide-react';

export const Navbar: React.FC = () => {
  return (
    <header className="h-16 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      {/* Brand & Context */}
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white hidden sm:inline-block">
            AI Knowledge Workspace
          </span>
        </Link>

        {/* Vertical divider */}
        <div className="h-5 w-px bg-white/10 hidden sm:block" />

        {/* Organization Switcher */}
        <OrgSwitcher />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 font-mono">
          <Terminal className="w-3 h-3 text-indigo-400" />
          <span>FastAPI + pgvector Ready</span>
        </div>

        <UserMenu />
      </div>
    </header>
  );
};
