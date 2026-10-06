'use client';

import React, { useState, useEffect, useCallback, use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOrgStore } from '@/stores/org.store';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import { useOrgMembers, memberLabel } from '@/hooks/use-org-data';
import { Project, DocumentItem, ProjectMember, ProjectRole } from '@/types/api.types';
import { DocumentUploadZone } from '@/components/documents/document-upload-zone';
import { DocumentTable } from '@/components/documents/document-table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Notice } from '@/components/ui/notice';
import { ErrorState, LoadingState } from '@/components/ui/state';
import { useToast } from '@/components/ui/toast';
import {
  FileText,
  Users,
  Bot,
  UserPlus,
  Trash2,
  UploadCloud,
  Pencil,
  RefreshCw,
} from 'lucide-react';

const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  PROJECT_MANAGER: 'Project Manager',
  PROJECT_MEMBER: 'Member',
};

export default function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const router = useRouter();
  const { showToast } = useToast();
  const { activeOrg, setActiveProject, setProjects, projects: storeProjects } = useOrgStore();
  const currentUser = useAuthStore((state) => state.user);

  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [activeTab, setActiveTab] = useState<'documents' | 'members'>('documents');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add Member Modal
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<ProjectRole>('PROJECT_MEMBER');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Remove member confirmation
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // Edit project modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete project confirmation
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { items: orgMembers, isLoading: isLoadingOrgMembers } = useOrgMembers(activeOrg?.id);

  const orgRole = activeOrg?.role || activeOrg?.user_role;
  const projectRole = project?.role || project?.user_role;
  // Only the org OWNER has implicit authority over every project; an ADMIN needs project membership like anyone else.
  const isOrgOwner = orgRole === 'OWNER';

  const canManage = projectRole === 'PROJECT_MANAGER' || isOrgOwner;
  const canUpload = Boolean(projectRole || isOrgOwner);

  // People who can grant access to this project (used in "ask X" hints)
  const managers = useMemo(
    () => members.filter((m) => m.role === 'PROJECT_MANAGER').map((m) => m.user?.full_name || m.user?.email),
    [members]
  );
  const managerHint = managers.length > 0 ? `Ask ${managers.join(' or ')}.` : 'Ask the organization owner.';

  // Org members that aren't in the project yet
  const addableMembers = useMemo(() => {
    const existing = new Set(members.map((m) => m.user_id));
    return orgMembers.filter((m) => !existing.has(m.user_id));
  }, [orgMembers, members]);

  const loadProjectData = useCallback(async () => {
    try {
      // 1. Fetch project info (the only request that decides "not found")
      const proj = await apiClient<Project>(`/projects/${projectId}`);
      setProject(proj);
      setActiveProject(proj);
      setLoadError(null);

      // 2 + 3. Documents and members load independently so one failure doesn't blank the page
      const [docsResult, membersResult] = await Promise.allSettled([
        apiClient<DocumentItem[]>(`/projects/${projectId}/documents`),
        apiClient<ProjectMember[]>(`/projects/${projectId}/members`),
      ]);

      if (docsResult.status === 'fulfilled') {
        setDocuments(Array.isArray(docsResult.value) ? docsResult.value : []);
      } else {
        showToast('Could not load documents for this project.', 'error');
      }
      if (membersResult.status === 'fulfilled') {
        setMembers(Array.isArray(membersResult.value) ? membersResult.value : []);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load project details');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, setActiveProject, showToast]);

  useEffect(() => {
    void loadProjectData();
    // Leaving the page means no project is "active" any more.
    return () => setActiveProject(null);
  }, [loadProjectData, setActiveProject]);

  // Poller: Poll document status every 3s if any document is QUEUED or PROCESSING
  const hasUnfinished = documents.some((d) => d.status === 'QUEUED' || d.status === 'PROCESSING');
  useEffect(() => {
    if (!hasUnfinished) return;

    const interval = setInterval(async () => {
      try {
        const refreshedDocs = await apiClient<DocumentItem[]>(`/projects/${projectId}/documents`);
        if (Array.isArray(refreshedDocs)) {
          setDocuments(refreshedDocs);
        }
      } catch {
        // silent polling error catch
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [hasUnfinished, projectId]);

  const handleRefreshDocuments = async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await apiClient<DocumentItem[]>(`/projects/${projectId}/documents`);
      setDocuments(Array.isArray(refreshed) ? refreshed : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to refresh documents', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const reloadMembers = async () => {
    const updated = await apiClient<ProjectMember[]>(`/projects/${projectId}/members`);
    setMembers(Array.isArray(updated) ? updated : []);
  };

  const handleCloseAddMember = () => {
    setIsAddMemberOpen(false);
    setNewMemberUserId('');
    setNewMemberRole('PROJECT_MEMBER');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberUserId) return;
    setIsAddingMember(true);

    try {
      await apiClient(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          userId: newMemberUserId,
          role: newMemberRole,
        }),
      });

      showToast('Member added to project', 'success');
      handleCloseAddMember();
      await reloadMembers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add member to project', 'error');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleChangeMemberRole = async (member: ProjectMember, role: ProjectRole) => {
    try {
      await apiClient(`/projects/${projectId}/members/${member.user_id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setMembers((prev) => prev.map((m) => (m.user_id === member.user_id ? { ...m, role } : m)));
      showToast('Project role updated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update role', 'error');
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemovingMember(true);
    try {
      await apiClient(`/projects/${projectId}/members/${memberToRemove.user_id}`, {
        method: 'DELETE',
      });
      setMembers((prev) => prev.filter((m) => m.user_id !== memberToRemove.user_id));
      showToast('Member removed from project', 'info');
      setMemberToRemove(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    } finally {
      setIsRemovingMember(false);
    }
  };

  const openEdit = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description || '');
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !editName.trim()) return;
    setIsSavingEdit(true);
    try {
      const updated = await apiClient<Project>(`/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
        }),
      });
      const merged: Project = { ...project, ...updated, role: updated.role ?? project.role };
      setProject(merged);
      setActiveProject(merged);
      setProjects(storeProjects.map((p) => (p.id === merged.id ? { ...p, ...merged } : p)));
      setIsEditOpen(false);
      showToast('Project updated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update project', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setIsDeleting(true);
    try {
      await apiClient(`/projects/${project.id}`, { method: 'DELETE' });
      setProjects(storeProjects.filter((p) => p.id !== project.id));
      showToast(`Project "${project.name}" deleted.`, 'info');
      router.push('/projects');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete project', 'error');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading project..." />;
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Link href="/projects" className="text-xs text-indigo-400 hover:text-indigo-300">
          ← Back to Projects
        </Link>
        <ErrorState
          title="Project unavailable"
          message={loadError || 'Project not found or you do not have permission to view it.'}
          onRetry={() => {
            setIsLoading(true);
            void loadProjectData();
          }}
        />
      </div>
    );
  }

  const headerRoleBadge = projectRole ? (
    <Badge variant={projectRole === 'PROJECT_MANAGER' ? 'brand' : 'default'} size="sm">
      {PROJECT_ROLE_LABEL[projectRole]}
    </Badge>
  ) : isOrgOwner ? (
    <Badge variant="info" size="sm">Org Owner</Badge>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/projects', label: 'All Projects' }}
        title={project.name}
        badges={headerRoleBadge}
        description={project.description || 'No description provided for this project.'}
        actions={
          <>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={openEdit}>
                <Pencil className="w-4 h-4 mr-1.5" />
                Edit
              </Button>
            )}
            {canUpload && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setActiveTab('documents');
                  setTimeout(() => {
                    const uploadEl = document.getElementById('project-upload-zone');
                    uploadEl?.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
              >
                <UploadCloud className="w-4 h-4 mr-1.5" />
                Upload Document
              </Button>
            )}
            <Link href={`/chat?project=${project.id}`}>
              <Button size="sm">
                <Bot className="w-4 h-4 mr-1.5" />
                Chat with Project Docs
              </Button>
            </Link>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => setIsDeleteOpen(true)} className="text-rose-400 hover:text-rose-300">
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete
              </Button>
            )}
          </>
        }
      />

      {/* Plain-language statement of what this person can do here, and why anything is locked */}
      {canManage ? (
        <Notice variant="info" title={isOrgOwner && !projectRole ? 'You see this project as the organization Owner' : 'You manage this project'}>
          You can upload documents, add or remove people, and restrict who sees each document (shield icon). People must
          already be in the organization — invite new colleagues from <Link href="/settings/members" className="underline hover:text-white">Members</Link> first.
        </Notice>
      ) : (
        <Notice variant="lock" title="You are a Project Member">
          You can upload documents and chat with the ones you are allowed to see. Adding people, changing who can see a
          document, renaming and deleting are for project managers. {managerHint}
        </Notice>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2 overflow-x-auto" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'documents'}
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'documents'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white border border-transparent'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Documents ({documents.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'members'}
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'members'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white border border-transparent'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Project Members ({members.length})</span>
        </button>
      </div>

      {/* TAB 1: Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Upload Zone */}
          {canUpload ? (
            <DocumentUploadZone
              projectId={project.id}
              onUploadSuccess={loadProjectData}
            />
          ) : (
            <Notice variant="lock" title="Uploading is not available to you">
              Only members of this project can upload documents. {managerHint}
            </Notice>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {hasUnfinished
                ? 'Some documents are still being processed — this list refreshes automatically.'
                : 'Documents become searchable by the AI assistant once their status is Ready.'}
            </p>
            <Button size="sm" variant="ghost" onClick={handleRefreshDocuments} disabled={isRefreshing}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {!canManage && documents.length > 0 && (
            <p className="text-[11px] text-slate-500">
              Renaming, deleting, retrying and access settings are for project managers.
            </p>
          )}

          {/* Document Table */}
          <DocumentTable
            documents={documents}
            isLoading={false}
            onRefresh={loadProjectData}
            canManage={Boolean(canManage)}
          />
        </div>
      )}

      {/* TAB 2: Members */}
      {activeTab === 'members' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Authorized Project Members
                </CardTitle>
                <CardDescription>
                  Members who have access to this project and its unrestricted documents
                </CardDescription>
              </div>

              {canManage && (
                <Button size="sm" onClick={() => setIsAddMemberOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-1.5" /> Add Member
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!canManage && (
              <Notice variant="lock" className="mb-4" title="Only project managers can change who is in this project">
                {managerHint}
              </Notice>
            )}
            {members.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No members to show.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {members.map((member) => {
                  const isSelf = member.user_id === currentUser?.id;
                  return (
                    <div key={member.id ?? member.user_id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200">
                          {member.user?.full_name}
                          {isSelf && <span className="ml-1.5 text-[10px] font-normal text-slate-400">(You)</span>}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{member.user?.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {canManage ? (
                          <select
                            aria-label={`Project role for ${member.user?.full_name}`}
                            value={member.role}
                            onChange={(e) => handleChangeMemberRole(member, e.target.value as ProjectRole)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="PROJECT_MEMBER">Member</option>
                            <option value="PROJECT_MANAGER">Project Manager</option>
                          </select>
                        ) : (
                          <Badge variant={member.role === 'PROJECT_MANAGER' ? 'brand' : 'default'}>
                            {PROJECT_ROLE_LABEL[member.role]}
                          </Badge>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(member)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Remove member from project"
                            aria-label={`Remove ${member.user?.full_name} from project`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddMemberOpen}
        onClose={handleCloseAddMember}
        title="Add Member to Project"
        description="Grant a member of your organization access to this project."
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <Select
            label="Organization member"
            value={newMemberUserId}
            onChange={(e) => setNewMemberUserId(e.target.value)}
            required
            disabled={isLoadingOrgMembers}
            helperText={
              !isLoadingOrgMembers && addableMembers.length === 0
                ? 'Everyone in your organization is already in this project. To add someone new, an organization Owner or Admin must first invite them (Settings → Members → Invite).'
                : 'Only people who already belong to the organization are listed.'
            }
          >
            <option value="">{isLoadingOrgMembers ? 'Loading members…' : 'Select a person…'}</option>
            {addableMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {memberLabel(m)}
              </option>
            ))}
          </Select>

          <Select
            label="Project role"
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value as ProjectRole)}
          >
            <option value="PROJECT_MEMBER">Member (standard access)</option>
            <option value="PROJECT_MANAGER">Project Manager (manage members & documents)</option>
          </Select>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseAddMember}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isAddingMember} disabled={!newMemberUserId}>
              Add to Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Project"
        description="Update the project name and description."
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Project Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={100}
            required
            autoFocus
          />
          <Input
            label="Description (Optional)"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            maxLength={1000}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSavingEdit}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!memberToRemove}
        title="Remove from project?"
        message={
          <>
            <strong className="text-white">{memberToRemove?.user?.full_name}</strong> will lose access to
            this project and its documents.
          </>
        }
        confirmLabel="Remove"
        isLoading={isRemovingMember}
        onConfirm={handleRemoveMember}
        onCancel={() => setMemberToRemove(null)}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete project?"
        message={
          <>
            <strong className="text-white">{project.name}</strong> and all of its documents and searchable
            vector chunks will be permanently erased. This cannot be undone.
          </>
        }
        confirmLabel="Delete project"
        isLoading={isDeleting}
        onConfirm={handleDeleteProject}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </div>
  );
}
