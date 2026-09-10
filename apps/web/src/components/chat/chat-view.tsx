'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import {
  Conversation,
  Message,
  MessageSource,
  Project,
} from '@/types/api.types';
import { ChatMessageBubble } from './chat-message-bubble';
import { SourceCitationDrawer } from './source-citation-drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Sparkles,
  Loader2,
  FolderKanban,
  Check,
  Edit2,
} from 'lucide-react';

interface ChatViewProps {
  initialConversationId?: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ initialConversationId }) => {
  const router = useRouter();
  const { showToast } = useToast();
  const { activeOrg, projects } = useOrgStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Selected source for off-canvas drawer
  const [activeCitation, setActiveCitation] = useState<MessageSource | null>(null);

  // Project scope state for new/current conversation
  const [selectedProjectScope, setSelectedProjectScope] = useState<string>('all');

  // Renaming state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch conversations for active organization
  const loadConversations = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const convs = await apiClient<Conversation[]>(
        `/organizations/${activeOrg.id}/conversations`
      );
      const list = Array.isArray(convs) ? convs : [];
      setConversations(list);

      if (initialConversationId) {
        const found = list.find((c) => c.id === initialConversationId);
        if (found) {
          setActiveConversation(found);
          return;
        }
      }

      // If no initial conversation or not found, select first or prepare new
      if (list.length > 0 && !activeConversation) {
        setActiveConversation(list[0]);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  }, [activeOrg, initialConversationId, activeConversation]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 2. Fetch messages when active conversation changes
  const loadMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const msgs = await apiClient<Message[]>(`/conversations/${conversationId}/messages`);
      setMessages(Array.isArray(msgs) ? msgs : []);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load messages', 'error');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id);
      if (Array.isArray(activeConversation.project_ids) && activeConversation.project_ids.length > 0) {
        setSelectedProjectScope(activeConversation.project_ids[0]);
      } else {
        setSelectedProjectScope('all');
      }
    } else {
      setMessages([]);
    }
  }, [activeConversation, loadMessages]);

  // 3. Create a new conversation
  const handleStartNewChat = async () => {
    if (!activeOrg) return;
    try {
      const projectIds = selectedProjectScope !== 'all' ? [selectedProjectScope] : undefined;
      const created = await apiClient<Conversation>(
        `/organizations/${activeOrg.id}/conversations`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'New Conversation',
            project_ids: projectIds,
          }),
        }
      );

      setConversations((prev) => [created, ...prev]);
      setActiveConversation(created);
      setMessages([]);
      router.push(`/chat/${created.id}`);
      inputRef.current?.focus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create conversation', 'error');
    }
  };

  // 4. Send Message (with RAG Grounding & Sources)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    let conv = activeConversation;

    // If no active conversation, create one on the fly
    if (!conv) {
      if (!activeOrg) return;
      try {
        const projectIds = selectedProjectScope !== 'all' ? [selectedProjectScope] : undefined;
        conv = await apiClient<Conversation>(`/organizations/${activeOrg.id}/conversations`, {
          method: 'POST',
          body: JSON.stringify({
            title: 'New Conversation',
            project_ids: projectIds,
          }),
        });
        setConversations((prev) => [conv!, ...prev]);
        setActiveConversation(conv);
        router.push(`/chat/${conv.id}`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to initialize chat', 'error');
        return;
      }
    }

    const question = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Optimistically append user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conv.id,
      role: 'USER',
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const assistantMsg = await apiClient<Message>(
        `/conversations/${conv.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content: question }),
        }
      );

      setMessages((prev) => [...prev, assistantMsg]);
      // Update title if it changed from "New Conversation"
      if (conv.title === 'New Conversation') {
        const autoTitle = question.length > 35 ? `${question.substring(0, 32)}...` : question;
        setActiveConversation({ ...conv, title: autoTitle });
        setConversations((prev) =>
          prev.map((c) => (c.id === conv!.id ? { ...c, title: autoTitle } : c))
        );
      }
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to get answer', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient(`/conversations/${id}`, { method: 'DELETE' });
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeConversation?.id === id) {
        setActiveConversation(remaining[0] || null);
        if (remaining[0]) {
          router.push(`/chat/${remaining[0].id}`);
        } else {
          router.push('/chat');
        }
      }
      showToast('Conversation deleted.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete conversation', 'error');
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !renameTitle.trim()) return;

    try {
      const updated = await apiClient<Conversation>(`/conversations/${activeConversation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: renameTitle.trim() }),
      });

      setActiveConversation(updated);
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, title: updated.title } : c))
      );
      setIsRenaming(false);
      showToast('Conversation renamed', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to rename conversation', 'error');
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-xl overflow-hidden shadow-2xl">
      {/* 1. Left Sidebar: Conversation Thread List */}
      <div className="w-64 border-r border-white/5 bg-slate-900/40 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-3.5 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Conversations</span>
          <Button size="sm" variant="ghost" onClick={handleStartNewChat} className="h-7 px-2">
            <Plus className="w-3.5 h-3.5 mr-1 text-indigo-400" /> New
          </Button>
        </div>

        {/* List of Threads */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No conversations yet. Start a new chat!
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConversation?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversation(conv);
                    router.push(`/chat/${conv.id}`);
                  }}
                  className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    <span className="truncate">{conv.title}</span>
                  </div>

                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-slate-950/30 relative">
        {/* Top Control Bar: Title & Scope Selector */}
        <div className="h-14 border-b border-white/5 px-4 flex items-center justify-between bg-slate-900/30 backdrop-blur-md">
          {/* Conversation Title & Rename */}
          <div className="flex items-center gap-2 min-w-0">
            {isRenaming ? (
              <form onSubmit={handleRename} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  className="bg-slate-900 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white"
                  autoFocus
                />
                <button type="submit" className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <h3 className="text-xs font-semibold text-slate-200 truncate">
                  {activeConversation?.title || 'New AI Conversation'}
                </h3>
                {activeConversation && (
                  <button
                    onClick={() => {
                      setRenameTitle(activeConversation.title);
                      setIsRenaming(true);
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded"
                    title="Rename"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Project Knowledge Scope Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline-block">Knowledge Scope:</span>
            <div className="relative flex items-center">
              <FolderKanban className="w-3.5 h-3.5 text-indigo-400 absolute left-2 pointer-events-none" />
              <select
                value={selectedProjectScope}
                onChange={(e) => setSelectedProjectScope(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg pl-7 pr-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Accessible Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Message Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 && !isLoadingMessages ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white mb-4 shadow-xl shadow-indigo-600/20">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">Ask your corporate knowledge base</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Query across all authorized documents in this organization. Answers are strictly grounded with clickable source citations.
              </p>

              {/* Sample Prompt Suggestions */}
              <div className="grid grid-cols-1 gap-2 w-full mt-6 text-left">
                {[
                  'What are the key findings in our latest uploaded documents?',
                  'Summarize the compliance and security policies.',
                  'Extract the main financial metrics reported for this quarter.',
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(prompt);
                      inputRef.current?.focus();
                    }}
                    className="p-2.5 rounded-xl border border-white/5 bg-slate-900/60 hover:border-indigo-500/30 hover:bg-slate-800 text-xs text-slate-300 transition-colors cursor-pointer"
                  >
                    &quot;{prompt}&quot;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessageBubble
                  key={msg.id}
                  message={msg}
                  onCitationClick={(src) => setActiveCitation(src)}
                />
              ))}

              {isSending && (
                <div className="flex items-center gap-3 animate-in fade-in">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 text-xs text-slate-300 flex items-center gap-2">
                    <span>Searching pgvector knowledge base and grounding answer...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-white/5 bg-slate-900/40 backdrop-blur-md">
          <form
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask a question about your documents... (Enter to send, Shift+Enter for newline)"
              className="flex-1 bg-transparent border-0 resize-none px-2 py-1.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none max-h-32 min-h-[36px]"
            />

            <Button
              type="submit"
              size="sm"
              disabled={!inputText.trim() || isSending}
              isLoading={isSending}
              className="rounded-xl shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-[10px] text-slate-400 text-center mt-2">
            Answers are grounded in your authorized document vectors. Verify citations for mission-critical decisions.
          </p>
        </div>
      </div>

      {/* 3. Off-Canvas Source Citation Drawer */}
      <SourceCitationDrawer
        source={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
};
