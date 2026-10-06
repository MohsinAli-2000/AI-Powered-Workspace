'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { Project, DocumentItem, ProjectMember, ProjectRole } from '@/types/api.types';
import { DocumentUploadZone } from '@/components/documents/document-upload-zone';
import { DocumentTable } from '@/components/documents/document-table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  FileText,
  Users,
  Bot,
  ArrowLeft,
  UserPlus,
  Trash2,
  UploadCloud,
} from 'lucide-react';

export default function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const { showToast } = useToast();
  const { activeOrg, setActiveProject } = useOrgStore();

  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [activeTab, setActiveTab] = useState<'documents' | 'members'>('documents');
  const [isLoading, setIsLoading] = useState(true);

  // Add Member Modal
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<ProjectRole>('PROJECT_MEMBER');
  const [isAddingMember, setIsAddingMember] = useState(false);

  const orgRole = activeOrg?.role || activeOrg?.user_role;
  const projectRole = project?.role || project?.user_role;

  const canManage =
    projectRole === 'PROJECT_MANAGER' ||
    orgRole === 'OWNER' ||
    orgRole === 'ADMIN';

  const canUpload = Boolean(projectRole || orgRole === 'OWNER' || orgRole === 'ADMIN');

  const loadProjectData = useCallback(async () => {
    try {
      // 1. Fetch project info
      const proj = await apiClient<Project>(`/projects/${projectId}`);
      setProject(proj);
      setActiveProject(proj);

      // 2. Fetch project documents
      const docs = await apiClient<DocumentItem[]>(`/projects/${projectId}/documents`);
      setDocuments(Array.isArray(docs) ? docs : []);

      // 3. Fetch project members
      const mems = await apiClient<ProjectMember[]>(`/projects/${projectId}/members`);
      setMembers(Array.isArray(mems) ? mems : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load project details', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, setActiveProject, showToast]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  // Poller: Poll document status every 3s if any document is QUEUED or PROCESSING
  useEffect(() => {
    const hasUnfinished = Array.isArray(documents) && documents.some(
      (d) => d.status === 'QUEUED' || d.status === 'PROCESSING'
    );

    if (!hasUnfinished) return;

    const interval = setInterval(async () => {
      try {
        const refreshedDocs = await apiClient<DocumentItem[]>(
          `/projects/${projectId}/documents`
        );
        if (Array.isArray(refreshedDocs)) {
          setDocuments(refreshedDocs);
        }
      } catch {
        // silent polling error catch
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, projectId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberUserId.trim()) return;
    setIsAddingMember(true);

    try {
      await apiClient(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: newMemberUserId.trim(),
          role: newMemberRole,
        }),
      });

      showToast('Member added to project', 'success');
      setIsAddMemberOpen(false);
      setNewMemberUserId('');
      const updatedMembers = await apiClient<ProjectMember[]>(`/projects/${projectId}/members`);
      setMembers(updatedMembers);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add member to project', 'error');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await apiClient(`/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
      });
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      showToast('Member removed from project', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading project...</div>;
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Project not found or you do not have permission to view it.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">{project.name}</h1>
            {project.role && (
              <Badge variant={project.role === 'PROJECT_MANAGER' ? 'brand' : 'default'} size="sm">
                {project.role === 'PROJECT_MANAGER' ? 'Project Manager' : 'Member'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {project.description || 'No description provided for this project.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'documents'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Documents ({documents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'members'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
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
          {canUpload && (
            <DocumentUploadZone
              projectId={project.id}
              onUploadSuccess={loadProjectData}
            />
          )}

          {/* Document Table */}
          <DocumentTable
            documents={documents}
            isLoading={isLoading}
            onRefresh={loadProjectData}
            canManage={Boolean(canManage)}
          />
        </div>
      )}

      {/* TAB 2: Members */}
      {activeTab === 'members' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
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
            <div className="divide-y divide-white/5">
              {members.map((member) => (
                <div key={member.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{member.user?.full_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{member.user?.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={member.role === 'PROJECT_MANAGER' ? 'brand' : 'default'}>
                      {member.role}
                    </Badge>
                    {canManage && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Remove member from project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        title="Add Member to Project"
        description="Grant a member of your organization access to this project."
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <Input
            label="User ID (UUID)"
            placeholder="Paste member UUID"
            value={newMemberUserId}
            onChange={(e) => setNewMemberUserId(e.target.value)}
            required
            autoFocus
          />

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Project Role
            </label>
            <select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value as ProjectRole)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="PROJECT_MEMBER">PROJECT_MEMBER (Standard Access)</option>
              <option value="PROJECT_MANAGER">PROJECT_MANAGER (Manager Access)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAddMemberOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isAddingMember}>
              Add to Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
