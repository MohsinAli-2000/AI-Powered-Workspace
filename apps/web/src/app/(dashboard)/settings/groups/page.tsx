'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { useOrgMembers, memberLabel } from '@/hooks/use-org-data';
import { Group, GroupMember } from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Notice } from '@/components/ui/notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { useToast } from '@/components/ui/toast';
import { UsersRound, Plus, Trash2, UserPlus, X, Pencil } from 'lucide-react';

export default function GroupsPage() {
  const { showToast } = useToast();
  const { activeOrg } = useOrgStore();
  const orgId = activeOrg?.id;

  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create / edit group modal (editingGroup === null means "create")
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Group Details / Members Modal
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Delete confirmation
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPrivileged = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';
  const { items: orgMembers, isLoading: isLoadingOrgMembers } = useOrgMembers(
    isPrivileged ? orgId : null
  );

  const addableMembers = useMemo(() => {
    const existing = new Set(groupMembers.map((m) => m.user_id));
    return orgMembers.filter((m) => !existing.has(m.user_id));
  }, [orgMembers, groupMembers]);

  const loadGroups = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient<Group[]>(`/organizations/${orgId}/groups`);
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const openCreate = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDesc('');
    setIsFormOpen(true);
  };

  const openEdit = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDesc(group.description || '');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingGroup(null);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !groupName.trim()) return;
    setIsSaving(true);

    try {
      if (editingGroup) {
        const updated = await apiClient<Group>(`/groups/${editingGroup.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: groupName.trim(), description: groupDesc.trim() }),
        });
        setGroups((prev) =>
          prev.map((g) => (g.id === editingGroup.id ? { ...g, ...updated, member_count: g.member_count } : g))
        );
        setSelectedGroup((current) =>
          current && current.id === editingGroup.id ? { ...current, ...updated, member_count: current.member_count } : current
        );
        showToast(`Group "${updated.name}" updated`, 'success');
      } else {
        const newGroup = await apiClient<Group>(`/organizations/${orgId}/groups`, {
          method: 'POST',
          body: JSON.stringify({
            name: groupName.trim(),
            description: groupDesc.trim() || undefined,
          }),
        });
        setGroups((prev) => [...prev, { member_count: 0, ...newGroup }]);
        showToast(`Group "${newGroup.name}" created`, 'success');
      }
      closeForm();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save group', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient(`/groups/${groupToDelete.id}`, { method: 'DELETE' });
      setGroups((prev) => prev.filter((g) => g.id !== groupToDelete.id));
      showToast('Group deleted successfully', 'info');
      if (selectedGroup?.id === groupToDelete.id) {
        setSelectedGroup(null);
      }
      setGroupToDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete group', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenGroupDetails = async (group: Group) => {
    setSelectedGroup(group);
    setGroupMembers([]);
    setNewMemberUserId('');
    setIsLoadingMembers(true);
    try {
      const members = await apiClient<GroupMember[]>(`/groups/${group.id}/members`);
      setGroupMembers(Array.isArray(members) ? members : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load group members', 'error');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleAddMemberToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newMemberUserId) return;
    setIsAddingMember(true);

    try {
      await apiClient(`/groups/${selectedGroup.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: newMemberUserId }),
      });

      showToast('Member added to group', 'success');
      setNewMemberUserId('');
      const updatedMembers = await apiClient<GroupMember[]>(`/groups/${selectedGroup.id}/members`);
      const list = Array.isArray(updatedMembers) ? updatedMembers : [];
      setGroupMembers(list);
      // Keep the card's member count in sync with the real list
      setGroups((prev) =>
        prev.map((g) => (g.id === selectedGroup.id ? { ...g, member_count: list.length } : g))
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add member to group', 'error');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMemberFromGroup = async (userId: string) => {
    if (!selectedGroup) return;

    try {
      await apiClient(`/groups/${selectedGroup.id}/members/${userId}`, {
        method: 'DELETE',
      });

      const remaining = groupMembers.filter((m) => m.user_id !== userId);
      setGroupMembers(remaining);
      setGroups((prev) =>
        prev.map((g) => (g.id === selectedGroup.id ? { ...g, member_count: remaining.length } : g))
      );
      showToast('Member removed from group', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Organization Groups"
        description="Group people together (e.g. Legal, Finance, Engineering) so you can grant or deny access to a document for the whole team at once. Open a document's access settings to use a group."
        actions={
          isPrivileged ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Group
            </Button>
          ) : undefined
        }
      />

      {!isPrivileged ? (
        <Notice variant="lock" title="View only">
          Groups are created and edited by Owners and Admins. You can see which groups exist and who is in them.
        </Notice>
      ) : (
        <Notice variant="info" title="What groups are for">
          Put people in a group once, then allow or deny the whole group on a document (project → shield icon on the
          document → Group Rules). Group members still need to belong to the project.
        </Notice>
      )}

      {isLoading ? (
        <LoadingState message="Loading groups..." />
      ) : loadError ? (
        <ErrorState title="Couldn't load groups" message={loadError} onRetry={() => void loadGroups()} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="w-10 h-10" />}
          title="No groups configured"
          description="Create groups to grant batch access permissions for documents across multiple users."
          action={
            isPrivileged ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1.5" /> Create Group
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card key={group.id} hoverEffect className="relative flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold text-slate-100 truncate">
                    <button
                      type="button"
                      onClick={() => handleOpenGroupDetails(group)}
                      className="text-left hover:text-indigo-300 transition-colors cursor-pointer after:absolute after:inset-0"
                    >
                      {group.name}
                    </button>
                  </CardTitle>
                  <Badge variant="brand" size="sm">
                    {group.member_count ?? 0} {group.member_count === 1 ? 'member' : 'members'}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {group.description || 'No description set for this group.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex items-center justify-between text-xs text-slate-400">
                <span>{isPrivileged ? 'Click to manage members' : 'Click to view members'}</span>
                {isPrivileged && (
                  <div className="relative z-10 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(group)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                      title="Edit group"
                      aria-label={`Edit ${group.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupToDelete(group)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                      title="Delete group"
                      aria-label={`Delete ${group.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Group Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingGroup ? 'Edit Group' : 'Create Organization Group'}
        description={
          editingGroup
            ? 'Update the name and description of this group.'
            : 'Establish a functional team group within this organization.'
        }
      >
        <form onSubmit={handleSaveGroup} className="space-y-4">
          <Input
            label="Group Name"
            placeholder="e.g. Legal & Compliance"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            minLength={2}
            maxLength={100}
            required
            autoFocus
          />

          <Input
            label="Description (Optional)"
            placeholder="e.g. Members responsible for reviewing regulatory contracts"
            value={groupDesc}
            onChange={(e) => setGroupDesc(e.target.value)}
            maxLength={1000}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingGroup ? 'Save Changes' : 'Create Group'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Group Members Modal */}
      <Modal
        isOpen={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        title={`Group: ${selectedGroup?.name ?? ''}`}
        description={selectedGroup?.description || 'View and configure members belonging to this group.'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Add member form */}
          {isPrivileged && (
            <form onSubmit={handleAddMemberToGroup} className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <Select
                label="Add a person to this group"
                value={newMemberUserId}
                onChange={(e) => setNewMemberUserId(e.target.value)}
                required
                disabled={isLoadingOrgMembers || isLoadingMembers}
                className="flex-1"
              >
                <option value="">
                  {isLoadingOrgMembers
                    ? 'Loading people…'
                    : addableMembers.length === 0
                    ? 'Everyone is already in this group'
                    : 'Select a person…'}
                </option>
                {addableMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {memberLabel(m)}
                  </option>
                ))}
              </Select>
              <Button type="submit" size="sm" isLoading={isAddingMember} disabled={!newMemberUserId} className="sm:mb-px">
                <UserPlus className="w-4 h-4 mr-1.5" /> Add
              </Button>
            </form>
          )}

          {/* Members list */}
          <div className="border border-white/5 rounded-xl overflow-hidden">
            {isLoadingMembers ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading members...</div>
            ) : groupMembers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No members assigned to this group yet.
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                {groupMembers.map((gm) => (
                  <div key={gm.user_id} className="p-3 flex items-center justify-between hover:bg-white/[0.02]">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{gm.user?.full_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{gm.user?.email}</p>
                    </div>
                    {isPrivileged && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMemberFromGroup(gm.user_id)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                        title="Remove from group"
                        aria-label={`Remove ${gm.user?.full_name} from group`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setSelectedGroup(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!groupToDelete}
        title="Delete group?"
        message={
          <>
            <strong className="text-white">{groupToDelete?.name}</strong> will be removed along with any
            document access rules that reference it.
          </>
        }
        confirmLabel="Delete group"
        isLoading={isDeleting}
        onConfirm={handleDeleteGroup}
        onCancel={() => setGroupToDelete(null)}
      />
    </div>
  );
}
