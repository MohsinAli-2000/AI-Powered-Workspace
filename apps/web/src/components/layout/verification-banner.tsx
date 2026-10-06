'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { MailWarning } from 'lucide-react';

/** Reminds users with an unverified email to verify, and lets them re-send the link. */
export const VerificationBanner: React.FC = () => {
  const { user, refreshUser } = useAuthStore();
  const { showToast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!user || user.is_verified || isDismissed) return null;

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

  return (
    <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-amber-200">
      <MailWarning className="w-4 h-4 text-amber-400 shrink-0" />
      <span className="flex-1 min-w-[200px]">
        Please verify your email address (<strong>{user.email}</strong>) to secure your account.
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleResend}
          disabled={isSending}
          className="font-semibold text-amber-300 hover:text-amber-100 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
        >
          {isSending ? 'Sending…' : 'Resend email'}
        </button>
        <button
          type="button"
          onClick={() => void refreshUser()}
          className="text-amber-300/80 hover:text-amber-100 cursor-pointer"
        >
          I&apos;ve verified
        </button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-amber-300/60 hover:text-amber-100 cursor-pointer"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
