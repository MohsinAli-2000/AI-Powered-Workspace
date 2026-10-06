'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { User, ShieldCheck, MailWarning, KeyRound, LogOut, Building2 } from 'lucide-react';

export default function AccountPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, logout, refreshUser } = useAuthStore();
  const organizations = useOrgStore((state) => state.organizations);
  const [isSending, setIsSending] = useState(false);

  if (!user) return null;

  const handleResend = async () => {
    setIsSending(true);
    try {
      await apiClient('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      });
      showToast(`Verification email sent to ${user.email}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send verification email', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // The local session is cleared regardless.
    }
    logout();
    router.push('/login');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="My Account" description="Your personal profile and sign-in details." />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            Profile
          </CardTitle>
          <CardDescription>The name and email you use to sign in</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs">
            <div>
              <dt className="text-slate-400">Full name</dt>
              <dd className="mt-1 font-semibold text-slate-100">{user.full_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Email</dt>
              <dd className="mt-1 font-mono text-slate-100 break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Member since</dt>
              <dd className="mt-1 text-slate-100">{formatDate(user.created_at)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Email status</dt>
              <dd className="mt-1">
                {user.is_verified ? (
                  <Badge variant="success" className="gap-1">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="warning" className="gap-1">
                    <MailWarning className="w-3 h-3" /> Verification pending
                  </Badge>
                )}
              </dd>
            </div>
          </dl>

          {!user.is_verified && (
            <div className="mt-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="flex-1">
                Verify your email to secure your account. We sent a link to <strong>{user.email}</strong> when you registered.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={handleResend} isLoading={isSending}>
                  Resend email
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void refreshUser()}>
                  I&apos;ve verified
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Your organizations
          </CardTitle>
          <CardDescription>Switch between them from the selector in the top bar</CardDescription>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <p className="text-xs text-slate-400">You don&apos;t belong to any organization yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {organizations.map((org) => (
                <li key={org.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-slate-200 truncate">{org.name}</span>
                  {org.role && <Badge variant={org.role === 'OWNER' ? 'brand' : 'default'}>{org.role}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            Security
          </CardTitle>
          <CardDescription>Change your password or end this session</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/forgot-password">
            <Button variant="secondary" size="sm">
              <KeyRound className="w-4 h-4 mr-1.5" />
              Change password via email
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-1.5" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
