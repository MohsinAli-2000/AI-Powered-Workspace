'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatView } from '@/components/chat/chat-view';

function ChatPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');

  return (
    <div className="h-full">
      <ChatView />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading chat...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
