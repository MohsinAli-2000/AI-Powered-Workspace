import React from 'react';
import { MessageSource } from '@/types/api.types';
import { FileText } from 'lucide-react';

interface CitationPillProps {
  source: MessageSource;
  index: number;
  onClick: (source: MessageSource) => void;
}

export const CitationPill: React.FC<CitationPillProps> = ({ source, index, onClick }) => {
  const confidencePercent = Math.round(source.similarity * 100);

  return (
    <button
      onClick={() => onClick(source)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-500/50 text-[11px] text-indigo-300 transition-all cursor-pointer shadow-sm hover:shadow-indigo-500/10 group"
      title={`Click to inspect source chunk (${confidencePercent}% match)`}
    >
      <FileText className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
      <span className="font-semibold">[{index + 1}]</span>
      <span className="truncate max-w-[120px]">{source.document_title}</span>
      <span className="text-[10px] text-indigo-400/80 font-mono">
        {confidencePercent}%
      </span>
    </button>
  );
};
