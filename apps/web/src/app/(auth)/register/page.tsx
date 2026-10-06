'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient, ApiError } from '@/lib/api-client';
import { getSafeRedirect } from '@/lib/utils';
import { User, Lock, Mail, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

function RegisterForm() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const loginHref = redirectParam
    ? `/login?redirect=${encodeURIComponent(getSafeRedirect(redirectParam))}`
    : '/login';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }

    setIsLoading(true);

    try {
      await apiClient('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });

      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setResendMessage(null);
    try {
      await apiClient('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setResendMessage('A new verification email has been sent.');
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : 'Could not resend the email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Verification email sent!</h2>
        <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
          We have sent a verification link to <span className="font-semibold text-white">{email}</span>. Please click the link in your email to activate your account.
        </p>
        <div className="pt-2 space-y-2">
          <Link href={loginHref} className="block">
            <Button variant="secondary" className="w-full">
              Proceed to Sign In
            </Button>
          </Link>
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 cursor-pointer"
          >
            {isResending ? 'Sending…' : "Didn't get it? Resend the email"}
          </button>
          {resendMessage && <p className="text-xs text-slate-400">{resendMessage}</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Create your account</h2>
        <p className="text-xs text-slate-400 mt-1">
          Start collaborating on your organizational documents with AI
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
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
          type="email"
          label="Work Email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          leftIcon={<Mail className="w-4 h-4" />}
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
          isLoading={isLoading}
        >
          Create Account
          {!isLoading && <ArrowRight className="w-4 h-4 ml-1" />}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-slate-400 border-t border-white/5 pt-4">
        Already have an account?{' '}
        <Link href={loginHref} className="font-semibold text-indigo-400 hover:text-indigo-300">
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-center text-xs text-slate-400">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
