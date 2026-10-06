'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useOrgStore } from '@/stores/org.store';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import { useOrgMembers, memberLabel } from '@/hooks/use-org-data';
import { formatDate } from '@/lib/utils';
import { Organization } from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Notice } from '@/components/ui/notice';
import { useToast } from '@/components/ui/toast';
import { Building2, ShieldAlert, Trash2, KeyRound, Copy, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const currentUser = useAuthStore((state) => state.user);
  const { activeOrg, organizations, setOrganizations, setActiveOrg } = useOrgStore();

  const [orgName, setOrgName] = useState(activeOrg?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isIdCopied, setIsIdCopied] = useState(false);

  // Transfer Ownership state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [newOwnerUserId, setNewOwnerUserId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Delete Organization state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = activeOrg?.role === 'OWNER';
  const isAdmin = activeOrg?.role === 'ADMIN' || isOwner;

  const { items: orgMembers, isLoading: isLoadingMembers } = useOrgMembers(isOwner ? activeOrg?.id : null);
  const transferCandidates = useMemo(
    () => orgMembers.filter((m) => m.user_id !== currentUser?.id),
    [orgMembers, currentUser?.id]
  );

  useEffect(() => {
    if (activeOrg) {
      setOrgName(activeOrg.name);
    }
  }, [activeOrg]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !orgName.trim()) return;
    setIsUpdating(true);

    try {
      const updated = await apiClient<Organization>(`/organizations/${activeOrg.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: orgName.trim() }),
      });

      const updatedList = organizations.map((o) => (o.id === updated.id ? { ...o, name: updated.name } : o));
      setOrganizations(updatedList);
      setActiveOrg({ ...activeOrg, name: updated.name });
      showToast('Organization name updated successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update organization', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyId = async () => {
    if (!activeOrg) return;
    try {
      await navigator.clipboard.writeText(activeOrg.id);
      setIsIdCopied(true);
      setTimeout(() => setIsIdCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the ID is still selectable.
    }
  };

  const handleCloseTransfer = () => {
    setIsTransferModalOpen(false);
    setNewOwnerUserId('');
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !newOwnerUserId) return;
    setIsTransferring(true);

    try {
      await apiClient(`/organizations/${activeOrg.id}/transfer-ownership`, {
        method: 'POST',
        body: JSON.stringify({ newOwnerUserId }),
      });

      showToast('Ownership transferred successfully.', 'success');
      handleCloseTransfer();
      // Reload page to reflect demotion to ADMIN
      window.location.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to transfer ownership', 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCloseDelete = () => {
    setIsDeleteModalOpen(false);
    setDeleteConfirmationInput('');
  };

  const handleDeleteOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || deleteConfirmationInput !== activeOrg.name) return;
    setIsDeleting(true);

    try {
      await apiClient(`/organizations/${activeOrg.id}`, {
        method: 'DELETE',
      });

      showToast(`Organization "${activeOrg.name}" deleted.`, 'info');
      handleCloseDelete();

      const remaining = organizations.filter((o) => o.id !== activeOrg.id);
      setActiveOrg(remaining[0] || null);
      setOrganizations(remaining);
      router.push('/dashboard');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete organization', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!activeOrg) {
    return (
      <Card className="max-w-lg mx-auto text-center py-12">
        <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-100">No Organization Selected</h3>
        <p className="text-xs text-slate-400 mt-1 mb-5 max-w-sm mx-auto">
          You are not currently viewing an active organization. Use the organization switcher in the top navigation bar to create or select one.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Organization Settings"
        description="Manage general workspace settings and the organization lifecycle."
        badges={activeOrg.role ? <Badge variant="brand" size="sm">Your role: {activeOrg.role}</Badge> : undefined}
      />

      {!isAdmin && (
        <Notice variant="lock" title="View only">
          Only Owners and Admins can change organization settings. Ask your organization Owner if something needs to change.
        </Notice>
      )}
      {isAdmin && !isOwner && (
        <Notice variant="info" title="Owner-only actions">
          Transferring or deleting the organization (and removing members) can only be done by the Owner.
        </Notice>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            General Information
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? 'Update your company or workspace display name'
              : 'Only organization admins can change these details'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateName} className="space-y-4 max-w-md">
            <Input
              label="Organization Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={!isAdmin}
              minLength={2}
              maxLength={100}
              required
            />

            <div>
              <span className="block text-xs font-medium text-slate-400 mb-1">Organization ID</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 p-2.5 rounded-lg bg-slate-900 border border-white/5 font-mono text-xs text-slate-300 select-all break-all">
                  {activeOrg.id}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleCopyId} aria-label="Copy organization ID">
                  {isIdCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {activeOrg.created_at && (
              <p className="text-[11px] text-slate-400">Created {formatDate(activeOrg.created_at)}</p>
            )}

            {isAdmin && (
              <Button
                type="submit"
                size="sm"
                isLoading={isUpdating}
                disabled={orgName.trim() === activeOrg.name}
              >
                Save Changes
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {isOwner && (
        <Card className="border-rose-500/20 bg-rose-950/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-rose-400/70">
              Irreversible actions that affect the whole organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-white/5 bg-slate-900/60 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Transfer Organization Ownership</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Designate another member as the single organization OWNER. You will be demoted to ADMIN.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTransferModalOpen(true)}
                className="shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                Transfer Ownership
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-rose-200">Delete Organization</h4>
                <p className="text-[11px] text-rose-300/70 mt-0.5">
                  Permanently erase all projects, documents, vector chunks, and conversation histories.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                className="shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transfer Ownership Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={handleCloseTransfer}
        title="Transfer Organization Ownership"
        description="Choose the member who will receive full ownership authority."
      >
        <form onSubmit={handleTransferOwnership} className="space-y-4">
          <Select
            label="New owner"
            value={newOwnerUserId}
            onChange={(e) => setNewOwnerUserId(e.target.value)}
            required
            disabled={isLoadingMembers}
            helperText={
              !isLoadingMembers && transferCandidates.length === 0
                ? 'There is nobody else in this organization yet. Invite someone first.'
                : undefined
            }
          >
            <option value="">{isLoadingMembers ? 'Loading members…' : 'Select a member…'}</option>
            {transferCandidates.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {memberLabel(m)} — {m.role}
              </option>
            ))}
          </Select>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <strong>Warning:</strong> Every organization has strictly one OWNER. Once transferred, you cannot regain ownership without the new owner re-transferring it to you.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseTransfer}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={isTransferring} disabled={!newOwnerUserId}>
              Confirm Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Organization Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDelete}
        title="Delete Organization"
        description="This action cannot be undone. All documents and embeddings will be wiped."
      >
        <form onSubmit={handleDeleteOrg} className="space-y-4">
          <p className="text-xs text-slate-300">
            Please type <strong className="text-rose-400 font-mono">{activeOrg.name}</strong> to confirm deletion.
          </p>

          <Input
            aria-label="Type the organization name to confirm"
            placeholder={activeOrg.name}
            value={deleteConfirmationInput}
            onChange={(e) => setDeleteConfirmationInput(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseDelete}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={deleteConfirmationInput !== activeOrg.name}
              isLoading={isDeleting}
            >
              Permanently Delete
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
