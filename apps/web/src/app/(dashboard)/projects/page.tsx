'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { Project } from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { useToast } from '@/components/ui/toast';
import { FolderKanban, Plus, ArrowRight, ShieldCheck, Trash2, Search, Users, Bot } from 'lucide-react';

export default function ProjectsPage() {
  const { showToast } = useToast();
  const { activeOrg, setProjects } = useOrgStore();
  const orgId = activeOrg?.id;

  const [projects, setLocalProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Create Project Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Delete confirmation
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient<Project[]>(`/organizations/${orgId}/projects`);
      const projs = Array.isArray(data) ? data : [];
      setLocalProjects(projs);
      setProjects(projs);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, setProjects]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query)
    );
  }, [projects, search]);

  const handleCloseCreate = () => {
    setIsCreateModalOpen(false);
    setProjectName('');
    setProjectDescription('');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !projectName.trim()) return;
    setIsCreating(true);

    try {
      const newProj = await apiClient<Project>(`/organizations/${orgId}/projects`, {
        method: 'POST',
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
        }),
      });

      // The creator is the initial PROJECT_MANAGER (so the card shows the right actions).
      const created: Project = { ...newProj, role: newProj.role ?? 'PROJECT_MANAGER' };
      const updated = [created, ...projects];
      setLocalProjects(updated);
      setProjects(updated);
      showToast(`Project "${created.name}" created`, 'success');
      handleCloseCreate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create project', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient(`/projects/${projectToDelete.id}`, { method: 'DELETE' });
      const remaining = projects.filter((p) => p.id !== projectToDelete.id);
      setLocalProjects(remaining);
      setProjects(remaining);
      showToast(`Project "${projectToDelete.name}" deleted.`, 'info');
      setProjectToDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete project', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const orgRole = activeOrg?.role || activeOrg?.user_role;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects & Documents"
        description="A project is a folder of related documents with its own members. Open a project to upload files, manage access, or chat with its documents."
        actions={
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Project
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState message="Loading projects..." />
      ) : loadError ? (
        <ErrorState title="Couldn't load projects" message={loadError} onRetry={() => void loadProjects()} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-12 h-12" />}
          title="No projects yet"
          description="Create your first project to begin uploading organizational documents and scoping AI assistance."
          action={
            <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create Project
            </Button>
          }
        />
      ) : (
        <>
          {projects.length > 3 && (
            <div className="max-w-sm">
              <Input
                aria-label="Search projects"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
          )}

          {filteredProjects.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No projects match &quot;{search}&quot;.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => {
                const projectRole = project.role || project.user_role;
                // Org ADMINs have no implicit project authority (only the OWNER does).
                const isManager = projectRole === 'PROJECT_MANAGER' || orgRole === 'OWNER';

                return (
                  <Card key={project.id} hoverEffect className="relative h-full flex flex-col justify-between">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold text-slate-100 truncate">
                          <Link
                            href={`/projects/${project.id}`}
                            className="hover:text-indigo-300 transition-colors after:absolute after:inset-0"
                          >
                            {project.name}
                          </Link>
                        </CardTitle>
                        {projectRole && (
                          <Badge
                            variant={projectRole === 'PROJECT_MANAGER' ? 'brand' : 'default'}
                            size="sm"
                          >
                            {projectRole === 'PROJECT_MANAGER' ? 'Manager' : 'Member'}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="line-clamp-2 mt-1.5">
                        {project.description || 'No project description provided.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {typeof project.member_count === 'number' && (
                        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Users className="w-3.5 h-3.5" />
                          {project.member_count} {project.member_count === 1 ? 'member' : 'members'}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1 text-[11px] text-indigo-400 font-medium">
                          Upload & view documents <ArrowRight className="w-3.5 h-3.5" />
                        </span>

                        {/* Sit above the card-wide link so these stay independently clickable. */}
                        <div className="relative z-10 flex items-center gap-1">
                          <Link
                            href={`/chat?project=${project.id}`}
                            className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                            title="Chat with this project's documents"
                            aria-label={`Chat with ${project.name}`}
                          >
                            <Bot className="w-3.5 h-3.5" />
                          </Link>
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => setProjectToDelete(project)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete project"
                              aria-label={`Delete ${project.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreate}
        title="Create New Project"
        description="Establish a document knowledge domain within this organization."
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input
            label="Project Name"
            placeholder="e.g. Q4 Financial Audits"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            maxLength={100}
            required
            autoFocus
          />

          <Input
            label="Project Description (Optional)"
            placeholder="e.g. Balance sheets, tax disclosures, and SEC filings"
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            maxLength={1000}
          />

          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              As the project creator, you will automatically be assigned the <strong>PROJECT_MANAGER</strong> role.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseCreate}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!projectToDelete}
        title="Delete project?"
        message={
          <>
            <strong className="text-white">{projectToDelete?.name}</strong> and all of its documents and
            searchable vector chunks will be permanently erased. This cannot be undone.
          </>
        }
        confirmLabel="Delete project"
        isLoading={isDeleting}
        onConfirm={handleDeleteProject}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
}
