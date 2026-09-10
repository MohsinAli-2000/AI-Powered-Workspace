'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { Project } from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { FolderKanban, Plus, ArrowRight, ShieldCheck, Trash2 } from 'lucide-react';

export default function ProjectsPage() {
  const { showToast } = useToast();
  const { activeOrg, setProjects } = useOrgStore();

  const [projects, setLocalProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Project Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!activeOrg) return;
    setIsLoading(true);
    try {
      const data = await apiClient<Project[]>(`/organizations/${activeOrg.id}/projects`);
      setLocalProjects(data);
      setProjects(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load projects', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, setProjects, showToast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !projectName.trim()) return;
    setIsCreating(true);

    try {
      const newProj = await apiClient<Project>(`/organizations/${activeOrg.id}/projects`, {
        method: 'POST',
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
        }),
      });

      const updated = [newProj, ...projects];
      setLocalProjects(updated);
      setProjects(updated);
      showToast(`Project "${newProj.name}" created`, 'success');
      setIsCreateModalOpen(false);
      setProjectName('');
      setProjectDescription('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create project', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${projectName}"? All documents and vector chunks will be erased.`)) {
      return;
    }

    try {
      await apiClient(`/projects/${projectId}`, { method: 'DELETE' });
      const remaining = projects.filter((p) => p.id !== projectId);
      setLocalProjects(remaining);
      setProjects(remaining);
      showToast(`Project "${projectName}" deleted.`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete project', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Organization Projects</h1>
          <p className="text-xs text-slate-400 mt-1">
            Projects segment your documents, vector indexes, and AI assistant query context
          </p>
        </div>

        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Create Project
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading projects...</div>
      ) : projects.length === 0 ? (
        <Card className="text-center py-16">
          <FolderKanban className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No projects yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
            Create your first project to begin uploading organizational documents and scoping AI assistance.
          </p>
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Create Project
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const isManager =
              project.role === 'PROJECT_MANAGER' ||
              activeOrg?.role === 'OWNER' ||
              activeOrg?.role === 'ADMIN';

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card hoverEffect className="h-full flex flex-col justify-between cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold text-slate-100 truncate">
                        {project.name}
                      </CardTitle>
                      {project.role && (
                        <Badge
                          variant={project.role === 'PROJECT_MANAGER' ? 'brand' : 'default'}
                          size="sm"
                        >
                          {project.role === 'PROJECT_MANAGER' ? 'Manager' : 'Member'}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2 mt-1.5">
                      {project.description || 'No project description provided.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-[11px] text-indigo-400 font-medium">
                      Open Documents <ArrowRight className="w-3.5 h-3.5" />
                    </span>

                    {isManager && (
                      <button
                        onClick={(e) => handleDeleteProject(project.id, project.name, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project"
        description="Establish a document knowledge domain within this organization."
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input
            label="Project Name"
            placeholder="e.g. Q4 Financial Audits"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Project Description (Optional)"
            placeholder="e.g. Balance sheets, tax disclosures, and SEC filings"
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
          />

          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              As the project creator, you will automatically be assigned the <strong>PROJECT_MANAGER</strong> role.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
