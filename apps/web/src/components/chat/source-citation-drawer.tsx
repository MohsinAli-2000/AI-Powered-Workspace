'use client';

import React, { useEffect, useState } from 'react';
import { MessageSource } from '@/types/api.types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, FileText, Check, Copy, ExternalLink, ShieldCheck } from 'lucide-react';

interface SourceCitationDrawerProps {
  source: MessageSource | null;
  onClose: () => void;
}

export const SourceCitationDrawer: React.FC<SourceCitationDrawerProps> = ({ source, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (source) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [source, onClose]);

  if (!source) return null;

  const confidencePercent = Math.round(source.similarity * 100);

  const handleCopyExcerpt = () => {
    navigator.clipboard.writeText(source.content_excerpt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-slate-900 border-l border-white/10 shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Source Citation Details</h3>
              <p className="text-[11px] text-slate-400">pgvector cosine match</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Document Reference Card */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Source Document
            </p>
            <h4 className="text-sm font-semibold text-slate-100 break-words">
              {source.document_title}
            </h4>
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10px] text-slate-400">
              <span>Doc ID: {source.document_id.substring(0, 8)}...</span>
              {source.chunk_index !== undefined && <span>• Chunk #{source.chunk_index}</span>}
              {source.page_number && <span>• Page {source.page_number}</span>}
            </div>
          </div>

          {/* Similarity Score Meter */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Semantic Relevance Score</span>
              <span className="text-xs font-bold text-indigo-400 font-mono">
                {confidencePercent}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  confidencePercent >= 75
                    ? 'bg-emerald-500'
                    : confidencePercent >= 50
                    ? 'bg-indigo-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, confidencePercent)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Cosine similarity computed with 768-dimensional normalized embeddings via HNSW vector index.
            </p>
          </div>

          {/* Chunk Text Excerpt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Grounded Text Excerpt</span>
              <button
                onClick={handleCopyExcerpt}
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-indigo-500/30">
              {source.content_excerpt}
            </div>
          </div>

          {/* Access Assurance Note */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              This excerpt was verified against your active organization credentials before retrieval.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close Drawer
          </Button>
        </div>
      </div>
    </div>
  );
};
