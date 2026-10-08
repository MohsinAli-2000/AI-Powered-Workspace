'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgStore } from '@/stores/org.store';
import { apiClient, ApiError } from '@/lib/api-client';
import { AuthSession, Organization } from '@/types/api.types';
import { AlertCircle, CheckCircle2, Loader2, MailOpen, XCircle, Lock, User, Building2, ArrowRight } from 'lucide-react';

interface InvitationDetails {
  email: string;
  organizationName: string;
  role: string;
  hasAccount: boolean;
}

type Outcome = 'idle' | 'accepted' | 'declined';

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const { user, isAuthenticated, isLoading: isAuthLoading, logout, setSession } = useAuthStore();
  const { setOrganizations, setActiveOrg } = useOrgStore();

  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [busyAction, setBusyAction] = useState<'accept' | 'reject' | 'register' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Registration fields for new invitees without an account
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const returnPath = `/invitations/accept?token=${encodeURIComponent(token)}`;
  const authQuery = `?redirect=${encodeURIComponent(returnPath)}`;

  const fetchInvitationDetails = useCallback(async () => {
    if (!token) {
      setIsLoadingDetails(false);
      return;
    }

    setIsLoadingDetails(true);
    setDetailsError(null);

    try {
      const details = await apiClient<InvitationDetails>('/invitations/details', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setInvitationDetails(details);
    } catch (err) {
      setDetailsError(
        err instanceof ApiError
          ? err.message
          : 'Unable to load invitation details. The link may be expired or invalid.'
      );
    } finally {
      setIsLoadingDetails(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvitationDetails();
  }, [fetchInvitationDetails]);

  const handleAcceptExisting = async () => {
    setBusyAction('accept');
    setActionError(null);
    try {
      const membership = await apiClient<{ organization_id?: string }>('/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      try {
        const orgs = await apiClient<Organization[]>('/organizations');
        setOrganizations(orgs);
        const joined = Array.isArray(orgs)
          ? orgs.find((o) => o.id === membership?.organization_id)
          : undefined;
        if (joined) setActiveOrg(joined);
      } catch {
        // Fallback: switcher will reload organizations
      }
      setOutcome('accepted');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not accept the invitation. Please try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (fullName.trim().length < 2) {
      setActionError('Please enter your full name (at least 2 characters).');
      return;
    }

    if (password !== confirmPassword) {
      setActionError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setActionError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setActionError('Password must contain at least one letter and one number.');
      return;
    }

    setBusyAction('register');

    try {
      const session = await apiClient<AuthSession>('/invitations/accept-and-register', {
        method: 'POST',
        body: JSON.stringify({
          token,
          name: fullName.trim(),
          password,
        }),
      });

      // Automatically authenticate the user session
      setSession(session);

      // Refresh organizations and set active
      try {
        const orgs = await apiClient<Organization[]>('/organizations');
        setOrganizations(orgs);
        if (Array.isArray(orgs) && orgs.length > 0) {
          setActiveOrg(orgs[0]);
        }
      } catch {
        // Fallback
      }

      setOutcome('accepted');
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'Failed to create account and join organization. Please try again.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = async () => {
    setBusyAction('reject');
    setActionError(null);
    try {
      await apiClient('/invitations/reject', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setOutcome('declined');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not decline the invitation. Please try again.');
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

  if (isLoadingDetails || isAuthLoading) {
    return (
      <div className="py-8 text-center space-y-3" role="status">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
        <p className="text-xs text-slate-300">Loading invitation details...</p>
      </div>
    );
  }

  if (detailsError) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Invitation Unavailable</h2>
        <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
          {detailsError}
        </p>
        <Link href="/login" className="inline-block text-xs text-indigo-400 hover:text-indigo-300">
          Return to Sign In
        </Link>
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
          You have successfully joined <strong className="text-white">{invitationDetails?.organizationName}</strong>.
        </p>
        <div className="text-left rounded-xl border border-white/10 bg-slate-900/60 p-3.5 text-xs text-slate-300 leading-relaxed">
          <p className="font-semibold text-white mb-1">What happens next</p>
          You are now an active member of this organization. You can immediately access authorized workspace documents, projects, and AI chats.
        </div>
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

  // CASE 1: The invitee does not have an account yet.
  // Email ownership is verified by the token. Prompt them to set password and create account.
  if (invitationDetails && !invitationDetails.hasAccount && !isAuthenticated) {
    return (
      <div>
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto mb-3 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Join {invitationDetails.organizationName}</h2>
          <p className="text-xs text-slate-400 mt-1">
            You&apos;ve been invited as a <span className="font-semibold text-indigo-300">{invitationDetails.role}</span>.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Email verified: {invitationDetails.email}</span>
          </div>
        </div>

        {actionError && (
          <div role="alert" className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}

        <form onSubmit={handleRegisterAndAccept} className="space-y-3.5">
          <Input
            type="text"
            label="Full Name"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            autoFocus
            leftIcon={<User className="w-4 h-4" />}
          />

          <Input
            type="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            helperText="At least 8 characters, including a letter and a number."
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <Input
            type="password"
            label="Confirm Password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <Button
            type="submit"
            className="w-full mt-2"
            isLoading={busyAction === 'register'}
          >
            Create Account & Join Organization
            {busyAction !== 'register' && <ArrowRight className="w-4 h-4 ml-1" />}
          </Button>
        </form>

        <p className="text-[11px] text-slate-400 text-center mt-4">
          By joining, you will be automatically authenticated into the workspace.
        </p>
      </div>
    );
  }

  // CASE 2: The user has an account, but is NOT authenticated right now.
  if (invitationDetails && invitationDetails.hasAccount && !isAuthenticated) {
    return (
      <div className="text-center py-2 space-y-4">
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center">
          <MailOpen className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Join {invitationDetails.organizationName}</h2>
        <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
          An account already exists for <span className="font-semibold text-white">{invitationDetails.email}</span>. Please sign in to accept your invitation.
        </p>
        <div className="pt-2">
          <Link href={`/login${authQuery}`} className="block">
            <Button className="w-full">Sign In to Accept</Button>
          </Link>
        </div>
      </div>
    );
  }

  // CASE 3: Authenticated user whose email does NOT match the invitation email.
  if (
    isAuthenticated &&
    invitationDetails &&
    user?.email.toLowerCase() !== invitationDetails.email.toLowerCase()
  ) {
    return (
      <div className="text-center py-2 space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Different Account Required</h2>
        <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
          This invitation was sent to <strong className="text-white">{invitationDetails.email}</strong>, but you are currently signed in as <strong className="text-white">{user?.email}</strong>.
        </p>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Please sign out and sign in with the invited email address to accept this invitation.
        </p>
        <div className="pt-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              logout();
              router.push(`/login${authQuery}`);
            }}
          >
            Sign Out and Switch Account
          </Button>
        </div>
      </div>
    );
  }

  // CASE 4: Authenticated user whose email matches the invitation.
  return (
    <div className="text-center py-2 space-y-4">
      <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center">
        <MailOpen className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-white">Join {invitationDetails?.organizationName}</h2>
      <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
        You are signed in as <span className="font-semibold text-white">{user?.email}</span>. You have been invited as a <span className="font-semibold text-indigo-300">{invitationDetails?.role}</span>.
      </p>

      {actionError && (
        <div role="alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300 text-left">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="pt-2 space-y-2">
        <Button
          className="w-full"
          onClick={handleAcceptExisting}
          isLoading={busyAction === 'accept'}
          disabled={busyAction !== null}
        >
          Accept Invitation
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={handleReject}
          isLoading={busyAction === 'reject'}
          disabled={busyAction !== null}
        >
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
