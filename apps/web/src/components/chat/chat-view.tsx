'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import {
  Conversation,
  Message,
  MessageSource,
  Project,
} from '@/types/api.types';
import { ChatMessageBubble } from './chat-message-bubble';
import { SourceCitationDrawer } from './source-citation-drawer';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  X,
  PanelLeft,
  Search,
  Lock,
} from 'lucide-react';

interface ChatViewProps {
  initialConversationId?: string;
  defaultProjectId?: string;
}

const MAX_MESSAGE_LENGTH = 4000; // matches the API's validation limit

/** `/chat/<id>` -> `<id>`; `/chat` -> null. */
function conversationIdFromPath(pathname: string | null): string | null {
  const match = pathname?.match(/^\/chat\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const SAMPLE_PROMPTS = [
  'What are the key findings in our latest uploaded documents?',
  'Summarize the compliance and security policies.',
  'Extract the main financial metrics reported for this quarter.',
];

export const ChatView: React.FC<ChatViewProps> = ({ defaultProjectId }) => {
  const pathname = usePathname();
  const { showToast } = useToast();
  const { activeOrg, projects, setProjects } = useOrgStore();
  const orgId = activeOrg?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [isListOpen, setIsListOpen] = useState(false); // mobile conversation drawer

  // Selected source for off-canvas drawer
  const [activeCitation, setActiveCitation] = useState<MessageSource | null>(null);

  // Knowledge scope applies to a NEW conversation; an existing conversation's scope is fixed.
  const [selectedProjectScope, setSelectedProjectScope] = useState<string>(defaultProjectId || 'all');

  // Renaming state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');

  // Delete confirmation
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeIdRef = useRef<string | null>(null);
  // Set when we create a conversation locally, so the message-loading effect doesn't wipe the optimistic UI.
  const skipLoadForIdRef = useRef<string | null>(null);
  const messageRequestSeq = useRef(0);

  useEffect(() => {
    activeIdRef.current = activeConversation?.id ?? null;
  }, [activeConversation?.id]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Keep URL in sync without remounting the chat (native History API is integrated with the Next router).
  const syncUrl = useCallback((conversationId: string | null, mode: 'push' | 'replace' = 'push') => {
    const target = conversationId ? `/chat/${conversationId}` : '/chat';
    if (typeof window === 'undefined' || window.location.pathname === target) return;
    if (mode === 'replace') {
      window.history.replaceState(null, '', target);
    } else {
      window.history.pushState(null, '', target);
    }
  }, []);

  // 0. Make sure the project list (used by the scope selector) is available even when /chat is opened directly.
  useEffect(() => {
    if (!orgId || projects.length > 0) return;
    let cancelled = false;
    apiClient<Project[]>(`/organizations/${orgId}/projects`)
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setProjects(list);
      })
      .catch(() => {
        // The scope selector simply falls back to "All accessible projects".
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, projects.length, setProjects]);

  // 1. Fetch conversations for the active organization (once per organization)
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setHasLoadedConversations(false);
    (async () => {
      try {
        const convs = await apiClient<Conversation[]>(`/organizations/${orgId}/conversations`);
        if (cancelled) return;
        setConversations(Array.isArray(convs) ? convs : []);
      } catch (err) {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : 'Failed to load conversations', 'error');
        }
      } finally {
        if (!cancelled) setHasLoadedConversations(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, showToast]);

  // 2. Follow the URL: /chat/<id> selects that conversation, /chat shows a fresh draft.
  //    Only reacts to *changes* of the URL, so local state changes never get overridden by a stale path.
  const routeConversationId = conversationIdFromPath(pathname);
  const lastRouteIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!hasLoadedConversations) return;
    if (lastRouteIdRef.current === routeConversationId) return;
    lastRouteIdRef.current = routeConversationId;

    if (!routeConversationId) {
      if (activeIdRef.current) setActiveConversation(null);
      return;
    }
    if (routeConversationId === activeIdRef.current) return;

    const found = conversations.find((c) => c.id === routeConversationId);
    if (found) {
      setActiveConversation(found);
      return;
    }

    apiClient<Conversation>(`/conversations/${routeConversationId}`)
      .then((conv) => {
        if (lastRouteIdRef.current !== routeConversationId) return;
        setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev]));
        setActiveConversation(conv);
      })
      .catch(() => {
        if (lastRouteIdRef.current !== routeConversationId) return;
        showToast('That conversation could not be found.', 'error');
        syncUrl(null, 'replace');
        setActiveConversation(null);
      });
  }, [routeConversationId, hasLoadedConversations, conversations, showToast, syncUrl]);

  // 3. Load messages when the active conversation changes (by id, so renames don't trigger a reload)
  const activeConversationId = activeConversation?.id ?? null;
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    if (skipLoadForIdRef.current === activeConversationId) {
      skipLoadForIdRef.current = null;
      return;
    }

    const requestId = ++messageRequestSeq.current;
    setIsLoadingMessages(true);
    setMessages([]);
    apiClient<Message[]>(`/conversations/${activeConversationId}/messages`)
      .then((msgs) => {
        if (requestId !== messageRequestSeq.current) return;
        setMessages(Array.isArray(msgs) ? msgs : []);
        setTimeout(scrollToBottom, 100);
      })
      .catch((err) => {
        if (requestId !== messageRequestSeq.current) return;
        showToast(err instanceof Error ? err.message : 'Failed to load messages', 'error');
      })
      .finally(() => {
        if (requestId === messageRequestSeq.current) setIsLoadingMessages(false);
      });
  }, [activeConversationId, scrollToBottom, showToast]);

  // 4. Reflect the conversation's scope in the selector (read-only for existing conversations)
  useEffect(() => {
    if (activeConversation) {
      const ids = activeConversation.project_ids;
      setSelectedProjectScope(Array.isArray(ids) && ids.length > 0 ? ids[0] : 'all');
    }
  }, [activeConversation]);

  // Keep the newest message / "thinking" indicator in view
  useEffect(() => {
    if (messages.length > 0 || isSending) scrollToBottom();
  }, [messages.length, isSending, scrollToBottom]);

  // Auto-grow the textarea with its content
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputText]);

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((c) => (c.title || 'Untitled conversation').toLowerCase().includes(query));
  }, [conversations, conversationSearch]);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [projects]);

  const startNewChat = () => {
    setActiveConversation(null);
    setMessages([]);
    setIsRenaming(false);
    setSelectedProjectScope(defaultProjectId || 'all');
    setIsListOpen(false);
    syncUrl(null);
    inputRef.current?.focus();
  };

  const selectConversation = (conv: Conversation) => {
    setIsRenaming(false);
    setIsListOpen(false);
    setActiveConversation(conv);
    syncUrl(conv.id);
  };

  // 5. Send message (with RAG grounding & sources). A conversation is only created once there is a question.
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const question = inputText.trim();
    if (!question || isSending) return;
    if (question.length > MAX_MESSAGE_LENGTH) {
      showToast(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`, 'error');
      return;
    }

    let conv = activeConversation;
    setIsSending(true);

    if (!conv) {
      if (!orgId) {
        setIsSending(false);
        return;
      }
      try {
        const projectIds = selectedProjectScope !== 'all' ? [selectedProjectScope] : undefined;
        const title = question.length > 60 ? `${question.substring(0, 57)}...` : question;
        conv = await apiClient<Conversation>(`/organizations/${orgId}/conversations`, {
          method: 'POST',
          body: JSON.stringify({ title, project_ids: projectIds }),
        });
        skipLoadForIdRef.current = conv.id;
        setConversations((prev) => [conv as Conversation, ...prev]);
        setActiveConversation(conv);
        syncUrl(conv.id, 'replace');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to initialize chat', 'error');
        setIsSending(false);
        return;
      }
    }

    const conversationId = conv.id;
    setInputText('');

    // Optimistically append user message
    const tempId = `temp-${Date.now()}`;
    const tempUserMsg: Message = {
      id: tempId,
      conversation_id: conversationId,
      role: 'USER',
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const assistantMsg = await apiClient<Message>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: question }),
      });

      // Only touch the visible thread if the user is still looking at this conversation.
      if (activeIdRef.current === conversationId) {
        setMessages((prev) => [...prev, assistantMsg]);
        setTimeout(scrollToBottom, 50);
      }
      setConversations((prev) =>
        [...prev].sort((a, b) =>
          a.id === conversationId ? -1 : b.id === conversationId ? 1 : 0
        )
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to get answer', 'error');
      if (activeIdRef.current === conversationId) {
        // Roll back the optimistic message and give the question back so nothing is lost.
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInputText((current) => current || question);
      }
    } finally {
      setIsSending(false);
    }
  };

  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) return;
    const id = conversationToDelete.id;
    setIsDeleting(true);
    try {
      await apiClient(`/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversation?.id === id) {
        setActiveConversation(null);
        setMessages([]);
        syncUrl(null);
      }
      showToast('Conversation deleted.', 'info');
      setConversationToDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete conversation', 'error');
    } finally {
      setIsDeleting(false);
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

      const next: Conversation = { ...activeConversation, title: updated.title ?? renameTitle.trim() };
      setActiveConversation(next);
      setConversations((prev) => prev.map((c) => (c.id === next.id ? { ...c, title: next.title } : c)));
      setIsRenaming(false);
      showToast('Conversation renamed', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to rename conversation', 'error');
    }
  };

  const conversationScopeLabel = (() => {
    const ids = activeConversation?.project_ids;
    if (!ids || ids.length === 0) return 'All accessible projects';
    if (ids.length === 1) return projectNameById.get(ids[0]) || '1 project';
    return `${ids.length} projects`;
  })();

  const isDraft = !activeConversation;

  const conversationList = (
    <>
      {/* Header */}
      <div className="p-3.5 border-b border-white/5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-300">Conversations</span>
        <Button size="sm" variant="ghost" onClick={startNewChat} className="h-7 px-2">
          <Plus className="w-3.5 h-3.5 mr-1 text-indigo-400" /> New chat
        </Button>
      </div>

      {conversations.length > 6 && (
        <div className="px-2 pt-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              aria-label="Search conversations"
              placeholder="Search..."
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700/80 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* List of Threads */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!hasLoadedConversations ? (
          <div className="p-4 text-center text-xs text-slate-400">Loading...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            {conversations.length === 0
              ? 'No conversations yet. Ask your first question to start one.'
              : 'No conversations match your search.'}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = activeConversation?.id === conv.id;
            return (
              <div
                key={conv.id}
                className={`group w-full flex items-center justify-between gap-1 rounded-xl text-xs transition-colors border ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 font-semibold border-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border-transparent'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectConversation(conv)}
                  className="flex-1 min-w-0 flex items-center gap-2 pl-3 py-2.5 text-left cursor-pointer"
                  aria-current={isActive ? 'true' : undefined}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                  <span className="min-w-0">
                    <span className="block truncate">{conv.title || 'Untitled conversation'}</span>
                    <span className="block text-[10px] font-normal text-slate-500">
                      {formatDate(conv.updated_at)}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setConversationToDelete(conv)}
                  className="p-1.5 mr-1 rounded opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                  title="Delete conversation"
                  aria-label={`Delete conversation ${conv.title || ''}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-8rem)] min-h-[480px] rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-xl overflow-hidden shadow-2xl relative">
      {/* 1. Left Sidebar: Conversation Thread List (always visible on md+, drawer on mobile) */}
      <div className="hidden md:flex w-64 border-r border-white/5 bg-slate-900/40 flex-col shrink-0">
        {conversationList}
      </div>
      {isListOpen && (
        <div className="md:hidden absolute inset-0 z-20 flex">
          <div className="w-72 max-w-[85%] bg-slate-950 border-r border-white/10 flex flex-col shadow-2xl">
            {conversationList}
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setIsListOpen(false)} aria-hidden="true" />
        </div>
      )}

      {/* 2. Main Chat Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-slate-950/30 relative">
        {/* Top Control Bar: Title & Scope */}
        <div className="min-h-14 border-b border-white/5 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 bg-slate-900/30 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsListOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Show conversations"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            {isRenaming ? (
              <form
                onSubmit={handleRename}
                className="flex items-center gap-1.5"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
              >
                <input
                  type="text"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  maxLength={255}
                  aria-label="Conversation title"
                  className="bg-slate-900 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                  autoFocus
                />
                <button type="submit" className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded cursor-pointer" aria-label="Save title">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsRenaming(false)}
                  className="p-1 text-slate-400 hover:bg-slate-800 rounded cursor-pointer"
                  aria-label="Cancel rename"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-xs font-semibold text-slate-200 truncate">
                  {activeConversation ? activeConversation.title || 'Untitled conversation' : 'New conversation'}
                </h3>
                {activeConversation && (
                  <button
                    type="button"
                    onClick={() => {
                      setRenameTitle(activeConversation.title || '');
                      setIsRenaming(true);
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                    title="Rename conversation"
                    aria-label="Rename conversation"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Project Knowledge Scope */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 hidden sm:inline-block">Searching in:</span>
            {isDraft ? (
              <div className="relative flex items-center">
                <FolderKanban className="w-3.5 h-3.5 text-indigo-400 absolute left-2 pointer-events-none" />
                <select
                  aria-label="Knowledge scope"
                  value={selectedProjectScope}
                  onChange={(e) => setSelectedProjectScope(e.target.value)}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg pl-7 pr-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 max-w-[160px] sm:max-w-[240px] cursor-pointer"
                >
                  <option value="all">All accessible projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-slate-900 text-xs text-slate-300 max-w-[160px] sm:max-w-[240px]"
                title="The scope of a conversation is fixed when it is created. Start a new chat to search somewhere else."
              >
                <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{conversationScopeLabel}</span>
              </span>
            )}
          </div>
        </div>

        {/* Message Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoadingMessages ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2" role="status">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Loading messages...
            </div>
          ) : messages.length === 0 && !isSending ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-8 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white mb-4 shadow-xl shadow-indigo-600/20">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">Ask your knowledge base</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Answers are grounded in the documents you are allowed to see, with clickable source citations.
                {isDraft && ' Choose where to search at the top right, then type your question below.'}
              </p>

              {/* Sample Prompt Suggestions */}
              <div className="grid grid-cols-1 gap-2 w-full mt-6 text-left">
                {SAMPLE_PROMPTS.map((prompt) => (
                  <button
                    type="button"
                    key={prompt}
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
                <div className="flex items-center gap-3" role="status">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 text-xs text-slate-300 flex items-center gap-2">
                    <span>Searching your documents and preparing a grounded answer...</span>
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
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void handleSendMessage();
                }
              }}
              aria-label="Your question"
              placeholder="Ask a question about your documents..."
              className="flex-1 bg-transparent border-0 resize-none px-2 py-1.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none max-h-40 min-h-[36px]"
            />

            <Button
              type="submit"
              size="sm"
              disabled={!inputText.trim() || isSending}
              isLoading={isSending}
              className="rounded-xl shrink-0"
              aria-label="Send message"
              title="Send (Enter)"
            >
              {!isSending && <Send className="w-4 h-4" />}
            </Button>
          </form>

          <div className="flex items-center justify-between gap-3 mt-2 text-[10px] text-slate-400">
            <p>Enter to send · Shift+Enter for a new line. Verify citations for mission-critical decisions.</p>
            {inputText.length > MAX_MESSAGE_LENGTH * 0.8 && (
              <span className={inputText.length >= MAX_MESSAGE_LENGTH ? 'text-rose-400' : ''}>
                {inputText.length}/{MAX_MESSAGE_LENGTH}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Off-Canvas Source Citation Drawer */}
      <SourceCitationDrawer
        source={activeCitation}
        onClose={() => setActiveCitation(null)}
      />

      <ConfirmDialog
        isOpen={!!conversationToDelete}
        title="Delete conversation?"
        message={
          <>
            <strong className="text-white">{conversationToDelete?.title || 'This conversation'}</strong> and all of its
            messages will be permanently deleted.
          </>
        }
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={confirmDeleteConversation}
        onCancel={() => setConversationToDelete(null)}
      />
    </div>
  );
};
