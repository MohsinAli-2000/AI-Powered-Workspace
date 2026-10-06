'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgStore } from '@/stores/org.store';
import { apiClient, ApiError } from '@/lib/api-client';
import { Organization } from '@/types/api.types';
import { AlertCircle, CheckCircle2, Loader2, MailOpen, XCircle } from 'lucide-react';

type Outcome = 'idle' | 'accepted' | 'declined';

/**
 * Landing page for the link in an invitation email (`/invitations/accept?token=...`).
 * Accepting requires being signed in as the invited email address.
 */
function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuthStore();
  const { setOrganizations, setActiveOrg } = useOrgStore();

  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [busyAction, setBusyAction] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const returnPath = `/invitations/accept?token=${encodeURIComponent(token)}`;
  const authQuery = `?redirect=${encodeURIComponent(returnPath)}`;

  const handleAccept = async () => {
    setBusyAction('accept');
    setError(null);
    try {
      const membership = await apiClient<{ organization_id?: string }>('/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      // Refresh the org list so the newly joined organization is available immediately.
      try {
        const orgs = await apiClient<Organization[]>('/organizations');
        setOrganizations(orgs);
        const joined = Array.isArray(orgs)
          ? orgs.find((o) => o.id === membership?.organization_id)
          : undefined;
        if (joined) setActiveOrg(joined);
      } catch {
        // The switcher reloads organizations on the next page load anyway.
      }
      setOutcome('accepted');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept the invitation. Please try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = async () => {
    setBusyAction('reject');
    setError(null);
    try {
      await apiClient('/invitations/reject', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setOutcome('declined');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not decline the invitation. Please try again.');
    } finally {
      setBusyAction(null);
    }
  };

  if (!token) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Invitation link is invalid</h2>
        <p className="text-xs text-slate-300 max-w-sm mx-auto">
          This link is missing its invitation token. Please open the link from your invitation email again, or ask your administrator to send a new one.
        </p>
        <Link href="/login" className="inline-block text-xs text-indigo-400 hover:text-indigo-300">
          Go to Sign In
        </Link>
      </div>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="py-8 text-center space-y-3" role="status">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
        <p className="text-xs text-slate-300">Checking your session...</p>
      </div>
    );
  }

  if (outcome === 'accepted') {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">You&apos;re in!</h2>
        <p className="text-xs text-slate-300">
          The invitation was accepted. The organization is now available in your workspace.
        </p>
        <Button className="w-full" onClick={() => router.push('/dashboard')}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  if (outcome === 'declined') {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-300 mx-auto flex items-center justify-center">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Invitation declined</h2>
        <p className="text-xs text-slate-300">You have declined this invitation. No changes were made to your account.</p>
        <Button variant="secondary" className="w-full" onClick={() => router.push(isAuthenticated ? '/dashboard' : '/login')}>
          Continue
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-2 space-y-4">
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center">
          <MailOpen className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">You&apos;ve been invited</h2>
        <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
          Sign in (or create an account) using the email address the invitation was sent to, and you&apos;ll be able to accept it.
        </p>
        <div className="pt-2 space-y-2">
          <Link href={`/login${authQuery}`} className="block">
            <Button className="w-full">Sign In</Button>
          </Link>
          <Link href={`/register${authQuery}`} className="block">
            <Button variant="secondary" className="w-full">Create Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-2 space-y-4">
      <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center">
        <MailOpen className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-white">Join an organization</h2>
      <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
        You&apos;re signed in as <span className="font-semibold text-white">{user?.email}</span>. The invitation must have been sent to this address.
      </p>

      {error && (
        <div role="alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300 text-left">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="pt-2 space-y-2">
        <Button className="w-full" onClick={handleAccept} isLoading={busyAction === 'accept'} disabled={busyAction !== null}>
          Accept Invitation
        </Button>
        <Button variant="ghost" className="w-full" onClick={handleReject} isLoading={busyAction === 'reject'} disabled={busyAction !== null}>
          Decline
        </Button>
      </div>

      <p className="text-[11px] text-slate-400 pt-2">
        Wrong account?{' '}
        <button
          type="button"
          onClick={() => {
            logout();
            router.push(`/login${authQuery}`);
          }}
          className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
        >
          Sign out and switch
        </button>
      </p>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="text-center text-xs text-slate-400">Loading invitation...</div>}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
