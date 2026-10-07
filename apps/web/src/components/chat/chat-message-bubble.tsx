'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, MessageSource } from '@/types/api.types';
import { CitationPill } from './citation-pill';
import { Sparkles, User, Copy, Check, AlertCircle } from 'lucide-react';

interface ChatMessageBubbleProps {
  message: Message;
  onCitationClick: (source: MessageSource) => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  onCitationClick,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'USER';

  const isInsufficientInfo =
    message.role === 'ASSISTANT' &&
    (message.content.includes('could not find sufficient information') ||
      message.content.includes('Please ensure the relevant documents have been uploaded') ||
      message.content.includes('No documents have been uploaded') ||
      message.content.includes('are currently being processed and indexed') ||
      message.content.includes('did not find sections with sufficient relevance'));

  const isServiceNotice =
    message.role === 'ASSISTANT' &&
    (message.content.includes('Service Notice') ||
      message.content.includes('temporarily unavailable') ||
      message.content.includes('rate limit was exceeded') ||
      message.content.includes('quota or rate limit'));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked (insecure context / permissions); nothing else to do.
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="flex items-start gap-2.5 max-w-xl min-w-0">
          <div className="p-4 rounded-2xl rounded-tr-sm bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words min-w-0">
            {message.content}
          </div>
          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 shrink-0">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-6">
      <div className="flex items-start gap-3 max-w-3xl w-full">
        {/* Assistant Avatar */}
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/20">
          <Sparkles className="w-4 h-4" />
        </div>

        {/* Message Container */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="glass-card rounded-2xl rounded-tl-sm p-5 border border-white/10 text-xs sm:text-sm text-slate-100 leading-relaxed relative group">
            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
              title="Copy message"
              aria-label="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Service Error Notice Banner */}
            {isServiceNotice ? (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-rose-300">AI Service Notice</p>
                  <p className="mt-1 leading-relaxed text-rose-200/90 whitespace-pre-wrap">
                    {message.content.replace(/^⚠️\s*\*\*Service Notice\*\*\s*/i, '')}
                  </p>
                </div>
              </div>
            ) : isInsufficientInfo ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-300">Knowledge Scope Notice</p>
                  <p className="mt-1 leading-relaxed text-amber-200/90 whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ) : (
              <div className="markdown-body pr-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Citations Section */}
          {message.sources && message.sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pl-1">
              <span className="text-[11px] font-medium text-slate-400">
                Verified Sources:
              </span>
              {message.sources.map((src, i) => (
                <CitationPill
                  key={src.id || i}
                  source={src}
                  index={i}
                  onClick={onCitationClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
