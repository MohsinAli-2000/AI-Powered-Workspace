'use client';

import React, { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Rendered on the right of the label row, e.g. a "Forgot password?" link. */
  labelAction?: React.ReactNode;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type = 'text', label, labelAction, error, helperText, leftIcon, rightIcon, id, ...props },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [showPassword, setShowPassword] = useState(false);

    const isPassword = type === 'password';
    const effectiveType = isPassword && showPassword ? 'text' : type;
    const trailing = isPassword ? (
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    ) : (
      rightIcon
    );

    return (
      <div className="w-full space-y-1.5 text-left">
        {(label || labelAction) && (
          <div className="flex items-center justify-between gap-2">
            {label ? (
              <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
                {label}
              </label>
            ) : (
              <span />
            )}
            {labelAction}
          </div>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-slate-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            type={effectiveType}
            ref={ref}
            aria-invalid={error ? true : undefined}
            className={cn(
              'w-full bg-slate-900/80 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition-all duration-150',
              'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon ? 'pl-9' : '',
              trailing ? 'pr-9' : '',
              error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/40' : '',
              className
            )}
            {...props}
          />
          {trailing && <div className="absolute right-3 text-slate-400">{trailing}</div>}
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {helperText && !error && <p className="text-xs text-slate-400">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
