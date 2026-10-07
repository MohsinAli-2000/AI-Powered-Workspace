import React from 'react';
import { MessageSource } from '@/types/api.types';
import { FileText, ImageIcon } from 'lucide-react';

interface CitationPillProps {
  source: MessageSource;
  index: number;
  onClick: (source: MessageSource) => void;
}

export const CitationPill: React.FC<CitationPillProps> = ({ source, index, onClick }) => {
  const confidencePercent = Math.round((source.similarity ?? 0) * 100);
  const isImageSource = /\.(png|jpe?g|webp|jfif|bmp|gif|tiff?)$/i.test(source.document_title || '');

  return (
    <button
      type="button"
      onClick={() => onClick(source)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer shadow-sm group ${
        isImageSource
          ? 'border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-500/50 text-violet-300 hover:shadow-violet-500/10'
          : 'border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-500/50 text-indigo-300 hover:shadow-indigo-500/10'
      }`}
      title={`Click to inspect source ${isImageSource ? 'image OCR' : 'document'} chunk (${confidencePercent}% match)`}
    >
      {isImageSource ? (
        <ImageIcon className="w-3 h-3 text-violet-400 group-hover:scale-110 transition-transform" />
      ) : (
        <FileText className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
      )}
      <span className="font-semibold">[{index + 1}]</span>
      <span className="truncate max-w-[120px]">{source.document_title}</span>
      <span className={`text-[10px] font-mono ${isImageSource ? 'text-violet-400/80' : 'text-indigo-400/80'}`}>
        {confidencePercent}%
      </span>
    </button>
  );
};

