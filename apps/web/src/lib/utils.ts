import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names and resolve conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format an ISO date string for display, e.g. "Oct 6, 2026, 2:30 PM". */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Format a byte count as a human-readable size, e.g. "1.5 MB". */
export function formatBytes(input: number | string, decimals = 1): string {
  // Postgres returns bigint columns (e.g. file_size) as strings, so coerce before validating.
  const bytes = Number(input);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(decimals)} ${units[i]}`;
}

/**
 * Validates a post-login redirect target so it can only point inside this app
 * (prevents open redirects such as `//evil.com` or `https://evil.com`).
 */
export function getSafeRedirect(value: string | null | undefined, fallback = '/dashboard'): string {
  // URL parsers strip tab/CR/LF, so "/\t/evil.com" would otherwise resolve to "//evil.com".
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }
  return value;
}
