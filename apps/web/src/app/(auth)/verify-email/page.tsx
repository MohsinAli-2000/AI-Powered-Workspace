'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { CheckCircle2, AlertCircle, Mail, Loader2 } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token');

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refreshUser = useAuthStore((state) => state.refreshUser);

  const [token, setToken] = useState(tokenFromUrl || '');
  const [resendEmail, setResendEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = useCallback(async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) return;
    setStatus('loading');
    setMessage(null);

    try {
      await apiClient('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: tokenToVerify.trim() }),
      });
      setStatus('success');
      // If the user is signed in on this device, clear the "verification pending" state right away.
      void refreshUser();
    } catch (err: unknown) {
      setStatus('error');
      if (err instanceof ApiError) {
        setMessage(err.message);
      } else {
        setMessage('Verification failed. The token may be expired or invalid.');
      }
    }
  }, [refreshUser]);

  useEffect(() => {
    if (tokenFromUrl) {
      handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl, handleVerify]);

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

  if (status === 'success') {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Email Verified!</h2>
        <p className="text-xs text-slate-300">
          Your email has been verified successfully. You can now access your workspace.
        </p>
        <div className="pt-3">
          <Link href={isAuthenticated ? '/dashboard' : '/login'}>
            <Button className="w-full">{isAuthenticated ? 'Go to Dashboard' : 'Sign In'}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Verify your email</h2>
        <p className="text-xs text-slate-400 mt-1">
          Complete account verification to unlock full system capabilities
        </p>
      </div>

      {status === 'loading' && (
        <div className="py-8 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-300">Verifying your token with the server...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{message}</span>
        </div>
      )}

      {status !== 'loading' && (
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
            placeholder="Paste verification token here"
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
