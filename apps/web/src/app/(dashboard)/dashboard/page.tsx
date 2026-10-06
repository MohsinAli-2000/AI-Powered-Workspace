'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { Project, DocumentItem, Conversation } from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FolderKanban,
  FileText,
  Bot,
  ShieldCheck,
  Plus,
  ArrowRight,
  Database,
  Cpu,
  Layers,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { activeOrg, setProjects } = useOrgStore();

  const [projects, setLocalProjects] = useState<Project[]>([]);
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [conversationCount, setConversationCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!activeOrg) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // 1. Fetch projects
        const projs = await apiClient<Project[]>(`/organizations/${activeOrg.id}/projects`);
        if (cancelled) return;
        const projsList = Array.isArray(projs) ? projs : [];
        setLocalProjects(projsList);
        setProjects(projsList);

        // 2. Fetch conversations
        const convs = await apiClient<Conversation[]>(`/organizations/${activeOrg.id}/conversations`);
        if (cancelled) return;
        setConversationCount(Array.isArray(convs) ? convs.length : 0);

        // 3. Count documents across projects
        let totalDocs = 0;
        for (const p of projsList.slice(0, 5)) {
          try {
            const docs = await apiClient<DocumentItem[]>(`/projects/${p.id}/documents`);
            const docsList = Array.isArray(docs) ? docs : [];
            totalDocs += docsList.length;
          } catch {
            // ignore error for single project docs
          }
        }
        if (cancelled) return;
        setDocumentCount(totalDocs);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [activeOrg, setProjects]);

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back, <span className="gradient-text">{user?.full_name || 'Member'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Active Tenant: <strong className="text-slate-200">{activeOrg?.name || 'Loading...'}</strong> ({activeOrg?.role || 'MEMBER'})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/projects">
            <Button variant="secondary" size="sm">
              <FolderKanban className="w-4 h-4 mr-1.5" />
              Manage Projects
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hoverEffect>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Total Projects</p>
              <h3 className="text-2xl font-bold text-white mt-1">{projects.length}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Scoping your document domains</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FolderKanban className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card hoverEffect>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Indexed Documents</p>
              <h3 className="text-2xl font-bold text-white mt-1">{documentCount}+</h3>
              <p className="text-[11px] text-emerald-400 mt-0.5">Ready for pgvector search</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card hoverEffect>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Active Conversations</p>
              <h3 className="text-2xl font-bold text-white mt-1">{conversationCount}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Grounded RAG threads</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Bot className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card hoverEffect>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Access Control</p>
              <h3 className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> 6-Step Active
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">DENY Precedence Enforced</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Your Projects</h2>
            <p className="text-xs text-slate-400">
              Isolated document collections and scoped AI knowledge bases
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
              Create your first project to begin uploading organizational documents and scoping AI assistance.
            </p>
            <Link href="/projects">
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Create Project
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <span>Click to open document hub</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* System Infrastructure Status Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Active Microservices & Pipeline Architecture
          </CardTitle>
          <CardDescription>
            High-performance hybrid architecture backing your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-400" /> Node.js Express API
                </span>
                <Badge variant="success" size="sm">Port 5000</Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                Multi-tenant session security, role authorization, and relational schemas.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-violet-400" /> FastAPI AI Service
                </span>
                <Badge variant="success" size="sm">Port 8001</Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                Ollama embeddings, XML prompt isolation, and pgvector RAG streaming.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" /> pgvector Engine
                </span>
                <Badge variant="success" size="sm">768-Dim</Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                HNSW cosine index with 6-step access control evaluation at SQL engine level.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
