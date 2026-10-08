'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { getSafeRedirect } from '@/lib/utils';
import { AuthSession } from '@/types/api.types';
import { CheckCircle2, AlertCircle, Mail, Loader2, Lock, User, ArrowRight } from 'lucide-react';

interface VerifyResponse {
  email?: string;
  verified?: boolean;
  user?: unknown;
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const redirectParam = searchParams.get('redirect');
  const redirectTo = getSafeRedirect(redirectParam);

  const setSession = useAuthStore((state) => state.setSession);

  const [token, setToken] = useState(tokenFromUrl);
  const [resendEmail, setResendEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'completed' | 'error'>('idle');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  // Form fields for setting up account after verification
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const handleVerify = useCallback(async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) return;
    setStatus('verifying');
    setErrorMessage(null);

    try {
      const response = await apiClient<VerifyResponse>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: tokenToVerify.trim() }),
      });

      if (response?.email) {
        setVerifiedEmail(response.email);
      }

      // If this was a legacy verification for an already created user with session
      if (response?.user) {
        setStatus('completed');
        setTimeout(() => {
          router.push(redirectTo);
        }, 1500);
        return;
      }

      setStatus('verified');
    } catch (err: unknown) {
      setStatus('error');
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Verification failed. The token may be invalid or expired.');
      }
    }
  }, [router, redirectTo]);

  useEffect(() => {
    if (tokenFromUrl) {
      handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl, handleVerify]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);

    if (fullName.trim().length < 2) {
      setAccountError('Please enter your full name (at least 2 characters).');
      return;
    }

    if (password !== confirmPassword) {
      setAccountError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setAccountError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setAccountError('Password must contain at least one letter and one number.');
      return;
    }

    setIsSubmittingAccount(true);

    try {
      const session = await apiClient<AuthSession>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          token: token.trim(),
          name: fullName.trim(),
          password,
        }),
      });

      // Automatically authenticate the newly created user
      setSession(session);
      setStatus('completed');
      router.push(redirectTo);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setAccountError(err.message);
      } else {
        setAccountError('Failed to create account. Please try again.');
      }
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setIsResending(true);
    setResendStatus(null);

    try {
      await apiClient('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      setResendStatus('A new verification email has been dispatched.');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setResendStatus(`Failed: ${err.message}`);
      } else {
        setResendStatus('Could not resend email. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  if (status === 'completed') {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Account Created!</h2>
        <p className="text-xs text-slate-300">
          Your email has been verified and your account is active. Redirecting to your dashboard...
        </p>
        <div className="pt-2">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Email has been verified! Now the user creates password/account details.
  if (status === 'verified') {
    return (
      <div>
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto mb-3 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Complete account setup</h2>
          <p className="text-xs text-slate-400 mt-1">
            Email <span className="font-semibold text-emerald-400">{verifiedEmail || 'verified'}</span> confirmed. Choose your password to get started.
          </p>
        </div>

        {accountError && (
          <div role="alert" className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{accountError}</span>
          </div>
        )}

        <form onSubmit={handleCreateAccount} className="space-y-3.5">
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
            isLoading={isSubmittingAccount}
          >
            Create Account & Sign In
            {!isSubmittingAccount && <ArrowRight className="w-4 h-4 ml-1" />}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Verify your email</h2>
        <p className="text-xs text-slate-400 mt-1">
          Verify your email address before creating your account
        </p>
      </div>

      {status === 'verifying' && (
        <div className="py-8 text-center space-y-3" role="status">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-300">Verifying your link with the server...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {status !== 'verifying' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify(token);
          }}
          className="space-y-4"
        >
          <Input
            type="text"
            label="Verification Token"
            placeholder="Paste your verification token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />

          <Button type="submit" className="w-full">
            Verify Email
          </Button>
        </form>
      )}

      <div className="mt-8 pt-6 border-t border-white/5">
        <h4 className="text-xs font-semibold text-slate-300 mb-2">Need a new verification link?</h4>
        <form onSubmit={handleResend} className="space-y-2">
          <Input
            type="email"
            placeholder="Enter your email"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            required
            leftIcon={<Mail className="w-4 h-4" />}
          />
          <Button type="submit" variant="secondary" size="sm" className="w-full" isLoading={isResending}>
            Resend Email
          </Button>
        </form>
        {resendStatus && (
          <p className="mt-2 text-xs text-slate-400">{resendStatus}</p>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-slate-400 border-t border-white/5 pt-4">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center text-xs text-slate-400">Loading verification...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
