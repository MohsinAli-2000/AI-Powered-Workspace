'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrgStore } from '@/stores/org.store';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
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
  X,
  Lock,
  HelpCircle,
  Shield,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
  matchExact?: boolean;
  /** Only shown to organization OWNER / ADMIN. */
  adminOnly?: boolean;
}

const WORKSPACE_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, hint: 'Your workspace at a glance', matchExact: true },
  { label: 'Projects & Documents', href: '/projects', icon: FolderKanban, hint: 'Upload and manage files' },
  { label: 'AI Assistant', href: '/chat', icon: Bot, hint: 'Ask questions about your documents' },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Members', href: '/settings/members', icon: Users, hint: 'People in this organization' },
  { label: 'Groups', href: '/settings/groups', icon: UsersRound, hint: 'Teams for document access' },
  { label: 'Invitations', href: '/settings/invitations', icon: Mail, hint: 'Invite colleagues', adminOnly: true },
  { label: 'Audit Logs', href: '/settings/audit-logs', icon: ScrollText, hint: 'Security & activity history', adminOnly: true },
  { label: 'Organization Settings', href: '/settings/organization', icon: Settings, hint: 'Name, ownership, deletion' },
];

const NavLink: React.FC<{ item: NavItem; pathname: string; locked?: boolean }> = ({
  item,
  pathname,
  locked = false,
}) => {
  const isActive = item.matchExact ? pathname === item.href : pathname.startsWith(item.href);
  const Icon = item.icon;

  // Locked items stay visible so people know the feature exists and what role it needs; the page itself
  // explains who to ask.
  if (locked) {
    return (
      <Link
        href={item.href}
        title={`${item.label}: Owners and Admins only. ${item.hint}`}
        className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium border border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/40 transition-all"
      >
        <Icon className="w-4 h-4 shrink-0 text-slate-600" />
        <span className="truncate flex-1">{item.label}</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
          <Lock className="w-3 h-3" /> Admin
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      title={item.hint}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
        isActive
          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 shadow-sm'
          : 'text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-900/60'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
};

const SidebarContent: React.FC = () => {
  const pathname = usePathname();
  const { activeOrg, activeProject } = useOrgStore();
  const { user } = useAuthStore();

  const isAdmin = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';

  // "Active project" only means something while you are looking at that project.
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const showProjectBanner = Boolean(projectMatch && activeProject && activeProject.id === projectMatch[1]);

  return (
    <div className="flex flex-col h-full">
      {showProjectBanner && activeProject && (
        <div className="p-3 mx-3 mt-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-300">
            <FolderGit2 className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
            <span className="truncate">Viewing: {activeProject.name}</span>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
        <div className="px-3 pb-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          Workspace
        </div>
        {WORKSPACE_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <div className="pt-6 px-3 pb-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          Team &amp; Administration
        </div>
        {ADMIN_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} locked={Boolean(item.adminOnly) && !isAdmin} />
        ))}

        <div className="pt-6 px-3 pb-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          Help
        </div>
        <NavLink
          item={{ label: 'Help & Roles', href: '/help', icon: HelpCircle, hint: 'How it works and who can do what' }}
          pathname={pathname}
        />

        {user?.is_platform_admin && (
          <>
            <div className="pt-6 px-3 pb-2 text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-amber-400" /> Platform Owner
            </div>
            <NavLink
              item={{
                label: 'Platform Admin',
                href: '/admin',
                icon: Shield,
                hint: 'Manage organizations and monitor platform',
              }}
              pathname={pathname}
            />
          </>
        )}
      </nav>

      {/* Tenant indicator */}
      <div className="p-3 border-t border-white/5 m-3">
        <div className="p-2.5 rounded-lg bg-slate-900/40 border border-white/5 text-[11px] text-slate-400">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Current organization</p>
          <p className="font-medium text-slate-300 truncate mt-0.5">{activeOrg?.name || 'None selected'}</p>
          {activeOrg?.role && (
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Your role: {activeOrg.role}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { isSidebarOpen, closeSidebar } = useUiStore();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  // Allow Escape to dismiss the drawer.
  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen, closeSidebar]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-white/5 bg-slate-950/60 backdrop-blur-xl flex-col shrink-0 overflow-hidden">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSidebar} aria-hidden="true" />
          <aside className="relative w-72 max-w-[85vw] h-full bg-slate-950 border-r border-white/10 shadow-2xl flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-white/5 shrink-0">
              <span className="text-sm font-bold text-white">Menu</span>
              <button
                type="button"
                onClick={closeSidebar}
                aria-label="Close menu"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
