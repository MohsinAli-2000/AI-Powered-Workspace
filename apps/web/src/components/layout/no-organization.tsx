'use client';

import React from 'react';
import { useOrgStore } from '@/stores/org.store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Building2, Mail, Plus } from 'lucide-react';

/** Shown instead of page content when the signed-in user doesn't belong to any organization yet. */
export const NoOrganization: React.FC = () => {
  const openCreateOrg = useOrgStore((state) => state.openCreateOrg);

  return (
    <Card className="max-w-lg mx-auto text-center py-12 px-6 mt-8">
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center mb-4">
        <Building2 className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-bold text-white">Welcome! Let&apos;s set up your workspace</h2>
      <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-sm mx-auto">
        Everything in this app — projects, documents and AI conversations — lives inside an organization.
        Create your own, or join an existing one through an invitation.
      </p>

      <div className="mt-6 space-y-3">
        <Button onClick={openCreateOrg} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-1.5" />
          Create an organization
        </Button>
        <div className="flex items-start gap-2 justify-center text-[11px] text-slate-400 max-w-xs mx-auto text-left">
          <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
          <span>
            Were you invited? Open the invitation link from your email while signed in with the invited address.
          </span>
        </div>
      </div>
    </Card>
  );
};
