'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrgStore } from '@/stores/org.store';
import {
  LayoutDashboard,
  FolderKanban,
  Bot,
  Users,
  Settings,
  FolderGit2,
  Mail,
  UsersRound,
  ScrollText,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { activeOrg, activeProject } = useOrgStore();

  const navItems = [
    {
      label: 'Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      matchExact: true,
    },
    {
      label: 'Projects & Docs',
      href: '/projects',
      icon: FolderKanban,
      matchExact: false,
    },
    {
      label: 'AI Assistant',
      href: '/chat',
      icon: Bot,
      matchExact: false,
    },
  ];

  const orgSettingsItems = [
    {
      label: 'Org Settings',
      href: '/settings/organization',
      icon: Settings,
    },
    {
      label: 'Members',
      href: '/settings/members',
      icon: Users,
    },
    {
      label: 'Groups',
      href: '/settings/groups',
      icon: UsersRound,
    },
    {
      label: 'Invitations',
      href: '/settings/invitations',
      icon: Mail,
    },
    {
      label: 'Audit Logs',
      href: '/settings/audit-logs',
      icon: ScrollText,
    },
  ];

  return (
    <aside className="w-64 border-r border-white/5 bg-slate-950/60 backdrop-blur-xl flex flex-col shrink-0 min-h-[calc(100vh-64px)]">
      {/* Active Project Banner if inside a project */}
      {activeProject && (
        <div className="p-3 mx-3 mt-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-300">
            <FolderGit2 className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
            <span className="truncate">Project: {activeProject.name}</span>
          </div>
        </div>
      )}

      {/* Main Workspace Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          Workspace
        </div>

        {navItems.map((item) => {
          const isActive = item.matchExact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Organization Administration Section */}
        <div className="pt-6 px-3 pb-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          Organization
        </div>

        {orgSettingsItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Tenant Indicator at bottom */}
      <div className="p-3 border-t border-white/5 m-3">
        <div className="p-2.5 rounded-lg bg-slate-900/40 border border-white/5 text-[11px] text-slate-400">
          <p className="font-medium text-slate-300 truncate">
            {activeOrg?.name || 'No Org Active'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
            Tenant: {activeOrg?.id ? `${activeOrg.id.substring(0, 8)}...` : 'None'}
          </p>
        </div>
      </div>
    </aside>
  );
};
