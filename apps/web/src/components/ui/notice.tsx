import React from 'react';
import { cn } from '@/lib/utils';
import { Info, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface NoticeProps {
  /** `lock` is for "you can't do this, and here is why". */
  variant?: 'info' | 'lock' | 'warning' | 'success';
  title?: string;
  children?: React.ReactNode;
  /** Optional call to action, e.g. a link or button. */
  action?: React.ReactNode;
  className?: string;
}

const STYLES = {
  info: { box: 'bg-sky-500/10 border-sky-500/20 text-sky-100', icon: 'text-sky-400', Icon: Info },
  lock: { box: 'bg-slate-500/10 border-slate-500/30 text-slate-200', icon: 'text-slate-400', Icon: Lock },
  warning: { box: 'bg-amber-500/10 border-amber-500/20 text-amber-100', icon: 'text-amber-400', Icon: AlertTriangle },
  success: { box: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100', icon: 'text-emerald-400', Icon: CheckCircle2 },
} as const;

/** Inline explanation box used for guidance and for explaining why something is unavailable. */
export const Notice: React.FC<NoticeProps> = ({ variant = 'info', title, children, action, className }) => {
  const { box, icon, Icon } = STYLES[variant];
  return (
    <div
      role={variant === 'warning' ? 'alert' : 'note'}
      className={cn('flex items-start gap-3 rounded-xl border p-3.5 text-xs leading-relaxed', box, className)}
    >
      <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', icon)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-white mb-0.5">{title}</p>}
        {children && <div className="text-slate-300">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
};
