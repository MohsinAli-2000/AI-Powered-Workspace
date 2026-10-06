import React from 'react';
import { Card } from './card';
import { Button } from './button';
import { AlertCircle, Loader2 } from 'lucide-react';

/** Centered spinner with a short message, for page-level loading. */
export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading…' }) => (
  <div className="py-16 flex flex-col items-center justify-center gap-3 text-xs text-slate-400" role="status">
    <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
    <span>{message}</span>
  </div>
);

/** Page-level failure with a retry button, so a failed request is never mistaken for "no data". */
export const ErrorState: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
}> = ({ title = 'Something went wrong', message, onRetry }) => (
  <Card className="text-center py-12 px-6 border-rose-500/20">
    <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
    <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
    {message && <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">{message}</p>}
    {onRetry && (
      <Button size="sm" variant="secondary" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    )}
  </Card>
);

/** Friendly empty list with an optional call to action. */
export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <Card className="text-center py-14 px-6">
    <div className="w-12 h-12 mx-auto mb-3 text-slate-400 flex items-center justify-center">{icon}</div>
    <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
    {description && (
      <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </Card>
);
