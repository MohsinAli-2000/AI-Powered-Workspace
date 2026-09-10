'use client';

import React, { useState, useEffect } from 'react';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { Organization } from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { Building2, ShieldAlert, Trash2, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { activeOrg, organizations, setOrganizations, setActiveOrg } = useOrgStore();

  const [orgName, setOrgName] = useState(activeOrg?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !newOwnerUserId.trim()) return;
    setIsTransferring(true);

    try {
      await apiClient(`/organizations/${activeOrg.id}/transfer-ownership`, {
        method: 'POST',
        body: JSON.stringify({ new_owner_user_id: newOwnerUserId.trim() }),
      });

      showToast('Ownership transferred successfully.', 'success');
      setIsTransferModalOpen(false);
      // Reload page to reflect demotion to ADMIN
      window.location.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to transfer ownership', 'error');
    } finally {
      setIsTransferring(false);
    }
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
      setIsDeleteModalOpen(false);

      const remaining = organizations.filter((o) => o.id !== activeOrg.id);
      setOrganizations(remaining);
      setActiveOrg(remaining[0] || null);
      router.push('/dashboard');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete organization', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (activeOrg) {
      setOrgName(activeOrg.name);
    }
  }, [activeOrg]);

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
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Organization Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage general workspace settings, tenant metadata, and organization lifecycle
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            General Information
          </CardTitle>
          <CardDescription>Update your company or workspace display details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateName} className="space-y-4 max-w-md">
            <Input
              label="Organization Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={!isAdmin}
              required
            />

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Organization ID</label>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-white/5 font-mono text-xs text-slate-300 select-all">
                {activeOrg.id}
              </div>
            </div>

            {isAdmin && (
              <Button type="submit" size="sm" isLoading={isUpdating}>
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
              Administrative Danger Zone
            </CardTitle>
            <CardDescription className="text-rose-400/70">
              Irreversible actions that affect your entire organizational tenant
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
        onClose={() => setIsTransferModalOpen(false)}
        title="Transfer Organization Ownership"
        description="Select the member ID to receive full ownership authority."
      >
        <form onSubmit={handleTransferOwnership} className="space-y-4">
          <Input
            label="New Owner User ID"
            placeholder="Paste member UUID here"
            value={newOwnerUserId}
            onChange={(e) => setNewOwnerUserId(e.target.value)}
            required
          />

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <strong>Warning:</strong> Every organization has strictly one OWNER. Once transferred, you cannot regain ownership without the new owner re-transferring it to you.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsTransferModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={isTransferring}>
              Confirm Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Organization Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Organization"
        description="This action cannot be undone. All documents and embeddings will be wiped."
      >
        <form onSubmit={handleDeleteOrg} className="space-y-4">
          <p className="text-xs text-slate-300">
            Please type <strong className="text-rose-400 font-mono">{activeOrg.name}</strong> to confirm deletion.
          </p>

          <Input
            placeholder={activeOrg.name}
            value={deleteConfirmationInput}
            onChange={(e) => setDeleteConfirmationInput(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(false)}
            >
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
