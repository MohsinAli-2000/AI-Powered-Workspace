import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional "back" link shown above the title, e.g. { href: '/projects', label: 'Projects' }. */
  back?: { href: string; label: string };
  /** Small elements (badges) rendered next to the title. */
  badges?: React.ReactNode;
  /** Primary / secondary buttons, right-aligned on wide screens. */
  actions?: React.ReactNode;
}

/** Consistent page title block so every screen explains where you are and what you can do here. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, back, badges, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
    <div className="min-w-0">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-bold text-white tracking-tight break-words">{title}</h1>
        {badges}
      </div>
      {description && <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);
