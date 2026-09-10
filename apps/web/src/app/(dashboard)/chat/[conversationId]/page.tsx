'use client';

import React, { use } from 'react';
import { ChatView } from '@/components/chat/chat-view';

export default function ConversationDetailsPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const resolvedParams = use(params);
  const conversationId = resolvedParams.conversationId;

  return (
    <div className="h-full">
      <ChatView initialConversationId={conversationId} />
    </div>
  );
}
