'use client';

import React from 'react';
import Link from 'next/link';
import { useOrgStore } from '@/stores/org.store';
import { useOrgMembers } from '@/hooks/use-org-data';
import { ORG_ROLE_INFO, accessExplanation } from '@/lib/permissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Lock, HelpCircle, UserRound } from 'lucide-react';

interface YourAccessCardProps {
  /** Set when the user belongs to no project yet, to show who can add them. */
  showWhoToAsk?: boolean;
}

/**
 * "What can I do here?" - states the user's role in plain language, lists what they can and cannot do,
 * and (when they have no project yet) names the people who can add them.
 */
export const YourAccessCard: React.FC<YourAccessCardProps> = ({ showWhoToAsk = false }) => {
  const activeOrg = useOrgStore((state) => state.activeOrg);
  const role = activeOrg?.role;
  const { items: members } = useOrgMembers(showWhoToAsk ? activeOrg?.id : null);

  if (!activeOrg || !role) return null;
  const info = ORG_ROLE_INFO[role];
  const contacts = members.filter((m) => m.role === 'OWNER' || m.role === 'ADMIN');

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <UserRound className="w-4 h-4 text-indigo-400" />
            Your access in {activeOrg.name}
          </CardTitle>
          <Badge variant="brand">{info.label}</Badge>
        </div>
        <CardDescription>
          {info.tagline}. {accessExplanation(role)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-2">You can</p>
            <ul className="space-y-1.5">
              {info.can.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {info.cannot.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                You can&apos;t (ask an admin if you need to)
              </p>
              <ul className="space-y-1.5">
                {info.cannot.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {showWhoToAsk && contacts.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3.5 text-xs">
            <p className="font-semibold text-slate-100">Who can add you to a project?</p>
            <ul className="mt-1.5 space-y-0.5 text-slate-300">
              {contacts.map((c) => (
                <li key={c.user_id}>
                  {c.user?.full_name} <span className="text-slate-400 font-mono">({c.user?.email})</span>{' '}
                  <span className="text-slate-500">· {ORG_ROLE_INFO[c.role].label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-slate-400">
              Send them your email address; they add you under <em>Projects → their project → Project Members</em>.
            </p>
          </div>
        )}

        <Link href="/help" className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300">
          <HelpCircle className="w-3.5 h-3.5" /> How roles and document access work
        </Link>
      </CardContent>
    </Card>
  );
};
