'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Project, DocumentItem, Conversation } from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/state';
import {
  FolderKanban,
  FileText,
  Bot,
  ShieldCheck,
  Plus,
  ArrowRight,
  CheckCircle2,
  Circle,
  MessageSquare,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { activeOrg, setProjects } = useOrgStore();
  const orgId = activeOrg?.id;

  const [projects, setLocalProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [readyDocumentCount, setReadyDocumentCount] = useState(0);
  const [totalDocumentCount, setTotalDocumentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (isCancelled: () => boolean) => {
      if (!orgId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);

      try {
        const [projs, convs] = await Promise.all([
          apiClient<Project[]>(`/organizations/${orgId}/projects`),
          apiClient<Conversation[]>(`/organizations/${orgId}/conversations`),
        ]);
        if (isCancelled()) return;

        const projsList = Array.isArray(projs) ? projs : [];
        setLocalProjects(projsList);
        setProjects(projsList);
        setConversations(Array.isArray(convs) ? convs : []);

        // Count documents across *all* projects (in parallel); a single failing project is skipped.
        const docLists = await Promise.all(
          projsList.map((p) =>
            apiClient<DocumentItem[]>(`/projects/${p.id}/documents`).catch(() => [] as DocumentItem[])
          )
        );
        if (isCancelled()) return;
        const allDocs = docLists.flatMap((docs) => (Array.isArray(docs) ? docs : []));
        setTotalDocumentCount(allDocs.length);
        setReadyDocumentCount(allDocs.filter((d) => d.status === 'READY').length);
      } catch (err) {
        if (!isCancelled()) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        }
      } finally {
        if (!isCancelled()) setIsLoading(false);
      }
    },
    [orgId, setProjects]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchData(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const hasProjects = projects.length > 0;
  const hasDocuments = totalDocumentCount > 0;
  const hasConversations = conversations.length > 0;
  const allStepsDone = hasProjects && hasDocuments && hasConversations;

  const steps = [
    {
      done: hasProjects,
      title: 'Create a project',
      description: 'Projects group related documents and decide who can see them.',
      href: '/projects',
      cta: 'Create project',
    },
    {
      done: hasDocuments,
      title: 'Upload your documents',
      description: 'Open a project and drop in PDF, DOCX, XLSX, PPTX or TXT files.',
      href: hasProjects ? `/projects/${projects[0].id}` : '/projects',
      cta: 'Upload documents',
    },
    {
      done: hasConversations,
      title: 'Ask the AI assistant',
      description: 'Get answers grounded in your documents, with clickable sources.',
      href: '/chat',
      cta: 'Start chatting',
    },
  ];

  const recentConversations = conversations.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back, <span className="gradient-text">{user?.full_name || 'Member'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Working in <strong className="text-slate-200">{activeOrg?.name || '…'}</strong>
            {activeOrg?.role ? ` as ${activeOrg.role}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/projects">
            <Button variant="secondary" size="sm">
              <FolderKanban className="w-4 h-4 mr-1.5" />
              Projects & Documents
            </Button>
          </Link>
          <Link href="/chat">
            <Button size="sm">
              <Bot className="w-4 h-4 mr-1.5" />
              Ask AI Assistant
            </Button>
          </Link>
        </div>
      </div>

      {error && <ErrorState title="Couldn't load your dashboard" message={error} onRetry={() => void fetchData(() => false)} />}

      {/* Getting started */}
      {!isLoading && !error && !allStepsDone && (
        <Card className="border-indigo-500/20">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-100">Getting started</CardTitle>
            <CardDescription>Three quick steps to get answers from your own documents</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className={`p-4 rounded-xl border flex flex-col gap-3 ${
                    step.done ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10 bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {step.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-slate-100">
                        {index + 1}. {step.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                  {!step.done && (
                    <Link href={step.href} className="mt-auto">
                      <Button size="sm" variant="secondary" className="w-full">
                        {step.cta} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hoverEffect>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Projects</p>
              <h3 className="text-2xl font-bold text-white mt-1">{isLoading ? '–' : projects.length}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Document collections you can access</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FolderKanban className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card hoverEffect>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Searchable Documents</p>
              <h3 className="text-2xl font-bold text-white mt-1">{isLoading ? '–' : readyDocumentCount}</h3>
              <p className="text-[11px] text-emerald-400 mt-0.5">
                {isLoading || totalDocumentCount === readyDocumentCount
                  ? 'Processed and ready for AI search'
                  : `${totalDocumentCount - readyDocumentCount} more still processing`}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card hoverEffect>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Conversations</p>
              <h3 className="text-2xl font-bold text-white mt-1">{isLoading ? '–' : conversations.length}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Your AI chat threads</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Bot className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card hoverEffect>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Your Role</p>
              <h3 className="text-base font-bold text-white mt-1.5">{activeOrg?.role || 'MEMBER'}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">In {activeOrg?.name || 'this organization'}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Projects Grid Section */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Your Projects</h2>
              <p className="text-xs text-slate-400">
                Open a project to upload documents or manage who has access
              </p>
            </div>
            <Link href="/projects">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading projects...</div>
          ) : projects.length === 0 ? (
            <Card className="text-center py-12">
              <FolderKanban className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-200">No projects found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                {activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN'
                  ? 'Create your first project to begin uploading organizational documents and scoping AI assistance.'
                  : "You can only see projects you belong to. Ask a project manager or the organization owner to add you to one, or create your own."}
              </p>
              <Link href="/projects">
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1.5" /> Create Project
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.slice(0, 6).map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card hoverEffect className="h-full flex flex-col justify-between">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold text-slate-100 truncate">
                          {project.name}
                        </CardTitle>
                        {project.role && (
                          <Badge variant="brand" size="sm">
                            {project.role === 'PROJECT_MANAGER' ? 'Manager' : 'Member'}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="line-clamp-2">
                        {project.description || 'No description provided for this project.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 flex items-center justify-between text-xs text-slate-400">
                      <span>Open documents</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent conversations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent Chats</h2>
              <p className="text-xs text-slate-400">Pick up where you left off</p>
            </div>
            <Link href="/chat">
              <Button variant="ghost" size="sm">
                New chat <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          <Card>
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading conversations...</div>
            ) : recentConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No conversations yet. Ask the AI assistant your first question.
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {recentConversations.map((conv) => (
                  <li key={conv.id}>
                    <Link
                      href={`/chat/${conv.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {conv.title || 'Untitled conversation'}
                        </p>
                        <p className="text-[10px] text-slate-400">{formatDate(conv.updated_at)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
