'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  DocumentItem,
  DocumentAccessRulesSummary,
  DocumentAccessMode,
  DocumentEffect,
  OrganizationRole,
  ProjectRole,
} from '@/types/api.types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import {
  ShieldAlert,
  User,
  UsersRound,
  Shield,
  Trash2,
  Plus,
  Lock,
  Globe,
  CheckCircle2,
  Ban,
} from 'lucide-react';

interface AccessRulesDialogProps {
  documentItem: DocumentItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const AccessRulesDialog: React.FC<AccessRulesDialogProps> = ({
  documentItem,
  onClose,
  onUpdated,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'groups' | 'orgRoles' | 'projectRoles'>('users');
  const [summary, setSummary] = useState<DocumentAccessRulesSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Add rule form states
  const [userIdInput, setUserIdInput] = useState('');
  const [userEffectInput, setUserEffectInput] = useState<DocumentEffect>('ALLOW');

  const [groupIdInput, setGroupIdInput] = useState('');
  const [groupEffectInput, setGroupEffectInput] = useState<DocumentEffect>('ALLOW');

  const [orgRoleInput, setOrgRoleInput] = useState<OrganizationRole>('MEMBER');
  const [orgRoleEffectInput, setOrgRoleEffectInput] = useState<DocumentEffect>('ALLOW');

  const [projectRoleInput, setProjectRoleInput] = useState<ProjectRole>('PROJECT_MEMBER');
  const [projectRoleEffectInput, setProjectRoleEffectInput] = useState<DocumentEffect>('ALLOW');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRules = useCallback(async () => {
    if (!documentItem) return;
    setIsLoading(true);
    try {
      const data = await apiClient<DocumentAccessRulesSummary>(
        `/documents/${documentItem.id}/access-rules`
      );
      setSummary(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load access rules', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [documentItem, showToast]);

  useEffect(() => {
    if (documentItem) {
      loadRules();
    }
  }, [documentItem, loadRules]);

  const handleToggleMode = async (newMode: DocumentAccessMode) => {
    if (!documentItem) return;
    setIsSubmitting(true);
    try {
      await apiClient(`/documents/${documentItem.id}/access-mode`, {
        method: 'PATCH',
        body: JSON.stringify({ access_mode: newMode }),
      });
      showToast(`Document access mode set to ${newMode}`, 'success');
      await loadRules();
      onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update access mode', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddUserRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentItem || !userIdInput.trim()) return;
    setIsSubmitting(true);
    try {
      await apiClient(`/documents/${documentItem.id}/access-rules/users`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userIdInput.trim(), effect: userEffectInput }),
      });
      showToast('User access rule added.', 'success');
      setUserIdInput('');
      await loadRules();
      onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add user rule', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUserRule = async (userId: string) => {
    if (!documentItem) return;
    try {
      await apiClient(`/documents/${documentItem.id}/access-rules/users/${userId}`, {
        method: 'DELETE',
      });
      showToast('User rule removed.', 'info');
      await loadRules();
      onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete rule', 'error');
    }
  };

  const handleAddGroupRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentItem || !groupIdInput.trim()) return;
    setIsSubmitting(true);
    try {
      await apiClient(`/documents/${documentItem.id}/access-rules/groups`, {
        method: 'POST',
        body: JSON.stringify({ group_id: groupIdInput.trim(), effect: groupEffectInput }),
      });
      showToast('Group access rule added.', 'success');
      setGroupIdInput('');
      await loadRules();
      onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add group rule', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroupRule = async (groupId: string) => {
    if (!documentItem) return;
    try {
      await apiClient(`/documents/${documentItem.id}/access-rules/groups/${groupId}`, {
        method: 'DELETE',
      });
      showToast('Group rule removed.', 'info');
      await loadRules();
      onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete rule', 'error');
    }
  };

  const handleAddOrgRoleRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentItem) return;
    setIsSubmitting(true);
    try {
      await apiClient(`/documents/${documentItem.id}/access-rules/org-roles`, {
        method: 'POST',
        body: JSON.stringify({ role: orgRoleInput, effect: orgRoleEffectInput }),
      });
      showToast('Org role rule added.', 'success');
      await loadRules();
      onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add org role rule', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrgRoleRule = async (role: OrganizationRole) => {
    if (!documentItem) return;
    try {
      await apiClient(`/documents/${documentItem.id}/access-rules/org-roles/${role}`, {
        method: 'DELETE',
      });
      showToast('Org role rule removed.', 'info');
      await loadRules();
      onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete rule', 'error');
    }
  };

  const handleAddProjectRoleRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentItem) return;
    setIsSubmitting(true);
    try {
      await apiClient(`/documents/${documentItem.id}/access-rules/project-roles`, {
        method: 'POST',
        body: JSON.stringify({ role: projectRoleInput, effect: projectRoleEffectInput }),
      });
      showToast('Project role rule added.', 'success');
      await loadRules();
      onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add project role rule', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProjectRoleRule = async (role: ProjectRole) => {
    if (!documentItem) return;
    try {
      await apiClient(`/documents/${documentItem.id}/access-rules/project-roles/${role}`, {
        method: 'DELETE',
      });
      showToast('Project role rule removed.', 'info');
      await loadRules();
      onUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete rule', 'error');
    }
  };

  if (!documentItem) return null;

  const isRestricted = summary?.access_mode === 'RESTRICTED';

  return (
    <Modal
      isOpen={!!documentItem}
      onClose={onClose}
      title={`Access Control: ${documentItem.name}`}
      description="Configure granular document permissions and RAG retrieval boundaries."
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleToggleMode('PROJECT')}
            disabled={isSubmitting}
            className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
              !isRestricted
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-white/5 bg-slate-900/60 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                PROJECT Mode
              </span>
              {!isRestricted && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Default access: All authorized project members can view and search this document in AI RAG.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleToggleMode('RESTRICTED')}
            disabled={isSubmitting}
            className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
              isRestricted
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-white/5 bg-slate-900/60 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                RESTRICTED Mode
              </span>
              {isRestricted && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Strict 6-step evaluation: Only explicitly allowed users, groups, or roles can view and query.
            </p>
          </button>
        </div>

        {/* DENY Precedence Banner */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <strong>Strict Invariant (DENY Precedence):</strong> If any applicable user, group, or role rule evaluates to <strong className="text-rose-400">DENY</strong>, access is immediately blocked at the database engine level, overriding any ALLOW rules.
          </div>
        </div>

        {/* Tab Navigation if Restricted */}
        {isRestricted && (
          <div className="space-y-4">
            <div className="flex items-center gap-1 border-b border-white/5 pb-2 text-xs">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'users' ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                User Rules ({summary?.user_rules?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('groups')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'groups' ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                Group Rules ({summary?.group_rules?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('orgRoles')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'orgRoles' ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                Org Roles ({summary?.org_role_rules?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('projectRoles')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'projectRoles' ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                Project Roles ({summary?.project_role_rules?.length || 0})
              </button>
            </div>

            {/* TAB 1: User Rules */}
            {activeTab === 'users' && (
              <div className="space-y-3">
                <form onSubmit={handleAddUserRule} className="flex gap-2">
                  <Input
                    placeholder="User ID (UUID)"
                    value={userIdInput}
                    onChange={(e) => setUserIdInput(e.target.value)}
                    required
                    className="flex-1"
                  />
                  <select
                    value={userEffectInput}
                    onChange={(e) => setUserEffectInput(e.target.value as DocumentEffect)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="DENY">DENY</option>
                  </select>
                  <Button type="submit" size="sm" isLoading={isSubmitting}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Rule
                  </Button>
                </form>

                <div className="border border-white/5 rounded-xl divide-y divide-white/5 max-h-48 overflow-y-auto">
                  {summary?.user_rules?.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No individual user rules configured.</div>
                  ) : (
                    summary?.user_rules?.map((rule) => (
                      <div key={rule.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-white/[0.02]">
                        <span className="font-mono text-slate-300 text-[11px] truncate max-w-xs">{rule.user_id}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={rule.effect === 'ALLOW' ? 'success' : 'danger'}>{rule.effect}</Badge>
                          <button
                            onClick={() => handleDeleteUserRule(rule.user_id)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Group Rules */}
            {activeTab === 'groups' && (
              <div className="space-y-3">
                <form onSubmit={handleAddGroupRule} className="flex gap-2">
                  <Input
                    placeholder="Group ID (UUID)"
                    value={groupIdInput}
                    onChange={(e) => setGroupIdInput(e.target.value)}
                    required
                    className="flex-1"
                  />
                  <select
                    value={groupEffectInput}
                    onChange={(e) => setGroupEffectInput(e.target.value as DocumentEffect)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="DENY">DENY</option>
                  </select>
                  <Button type="submit" size="sm" isLoading={isSubmitting}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Rule
                  </Button>
                </form>

                <div className="border border-white/5 rounded-xl divide-y divide-white/5 max-h-48 overflow-y-auto">
                  {summary?.group_rules?.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No group rules configured.</div>
                  ) : (
                    summary?.group_rules?.map((rule) => (
                      <div key={rule.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-white/[0.02]">
                        <span className="font-mono text-slate-300 text-[11px] truncate max-w-xs">{rule.group_id}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={rule.effect === 'ALLOW' ? 'success' : 'danger'}>{rule.effect}</Badge>
                          <button
                            onClick={() => handleDeleteGroupRule(rule.group_id)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Org Roles */}
            {activeTab === 'orgRoles' && (
              <div className="space-y-3">
                <form onSubmit={handleAddOrgRoleRule} className="flex gap-2">
                  <select
                    value={orgRoleInput}
                    onChange={(e) => setOrgRoleInput(e.target.value as OrganizationRole)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 flex-1"
                  >
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <select
                    value={orgRoleEffectInput}
                    onChange={(e) => setOrgRoleEffectInput(e.target.value as DocumentEffect)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="DENY">DENY</option>
                  </select>
                  <Button type="submit" size="sm" isLoading={isSubmitting}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Rule
                  </Button>
                </form>

                <div className="border border-white/5 rounded-xl divide-y divide-white/5 max-h-48 overflow-y-auto">
                  {summary?.org_role_rules?.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No org role rules configured.</div>
                  ) : (
                    summary?.org_role_rules?.map((rule) => (
                      <div key={rule.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-white/[0.02]">
                        <span className="font-semibold text-slate-200 text-xs">{rule.role}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={rule.effect === 'ALLOW' ? 'success' : 'danger'}>{rule.effect}</Badge>
                          <button
                            onClick={() => handleDeleteOrgRoleRule(rule.role)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: Project Roles */}
            {activeTab === 'projectRoles' && (
              <div className="space-y-3">
                <form onSubmit={handleAddProjectRoleRule} className="flex gap-2">
                  <select
                    value={projectRoleInput}
                    onChange={(e) => setProjectRoleInput(e.target.value as ProjectRole)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 flex-1"
                  >
                    <option value="PROJECT_MEMBER">PROJECT_MEMBER</option>
                    <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
                  </select>
                  <select
                    value={projectRoleEffectInput}
                    onChange={(e) => setProjectRoleEffectInput(e.target.value as DocumentEffect)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="DENY">DENY</option>
                  </select>
                  <Button type="submit" size="sm" isLoading={isSubmitting}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Rule
                  </Button>
                </form>

                <div className="border border-white/5 rounded-xl divide-y divide-white/5 max-h-48 overflow-y-auto">
                  {summary?.project_role_rules?.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No project role rules configured.</div>
                  ) : (
                    summary?.project_role_rules?.map((rule) => (
                      <div key={rule.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-white/[0.02]">
                        <span className="font-semibold text-slate-200 text-xs">{rule.role}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={rule.effect === 'ALLOW' ? 'success' : 'danger'}>{rule.effect}</Badge>
                          <button
                            onClick={() => handleDeleteProjectRoleRule(rule.role)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-white/5">
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
