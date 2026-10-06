'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgStore } from '@/stores/org.store';
import { Navbar } from '@/components/layout/navbar';
import { Sidebar } from '@/components/layout/sidebar';
import { NoOrganization } from '@/components/layout/no-organization';
import { VerificationBanner } from '@/components/layout/verification-banner';
import { Loader2, Ban } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { activeOrg, isLoadingOrgs } = useOrgStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Remember where the user was heading so login can send them back.
      const target = pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
      router.push(`/login${target}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-xs text-slate-400">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Every page here is organization-scoped: wait for the org list, and guide brand-new users.
  let content: React.ReactNode = children;
  // (The account page and platform admin screens make sense without an organization.)
  if (!activeOrg && !pathname?.startsWith('/settings/account') && !pathname?.startsWith('/admin')) {
    content = isLoadingOrgs ? (
      <div className="py-24 flex flex-col items-center gap-3 text-xs text-slate-400" role="status">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        Loading your organizations...
      </div>
    ) : (
      <NoOrganization />
    );
  } else if (
    activeOrg?.status === 'SUSPENDED' &&
    !pathname?.startsWith('/settings/account') &&
    !pathname?.startsWith('/admin')
  ) {
    content = (
      <div className="py-12 max-w-lg mx-auto">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Ban className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">
            {activeOrg.name} is Suspended
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            This organization has been suspended by the platform administrator. Access to projects,
            documents, and the AI assistant is temporarily disabled.
          </p>
          {activeOrg.suspension_reason && (
            <div className="p-3 bg-slate-900/80 rounded-xl border border-white/5 text-[11px] text-rose-300 text-left">
              <span className="font-semibold block mb-0.5 text-slate-400">Reason:</span>
              {activeOrg.suspension_reason}
            </div>
          )}
          <p className="text-[11px] text-emerald-400 font-medium">
            ✓ All organizational documents, knowledge embeddings, and histories are securely preserved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0b0f19] overflow-hidden">
      <Navbar />
      <VerificationBanner />
      <div className="flex-1 min-h-0 flex">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{content}</div>
        </main>
      </div>
    </div>
  );
}
