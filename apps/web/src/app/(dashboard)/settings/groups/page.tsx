'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { Group, GroupMember } from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { UsersRound, Plus, Trash2, UserPlus, Shield, X } from 'lucide-react';

export default function GroupsPage() {
  const { showToast } = useToast();
  const { activeOrg } = useOrgStore();

  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Group Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Group Details / Members Modal
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  const isPrivileged = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';

  const loadGroups = useCallback(async () => {
    if (!activeOrg) return;
    setIsLoading(true);
    try {
      const data = await apiClient<Group[]>(`/organizations/${activeOrg.id}/groups`);
      setGroups(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load groups', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, showToast]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !groupName.trim()) return;
    setIsCreating(true);

    try {
      const newGroup = await apiClient<Group>(`/organizations/${activeOrg.id}/groups`, {
        method: 'POST',
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim() || undefined,
        }),
      });

      setGroups((prev) => [...prev, newGroup]);
      showToast(`Group "${newGroup.name}" created`, 'success');
      setIsCreateModalOpen(false);
      setGroupName('');
      setGroupDesc('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create group', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeOrg) return;

    try {
      await apiClient(`/groups/${groupId}`, { method: 'DELETE' });
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      showToast('Group deleted successfully', 'info');
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete group', 'error');
    }
  };

  const handleOpenGroupDetails = async (group: Group) => {
    setSelectedGroup(group);
    setIsLoadingMembers(true);
    try {
      const members = await apiClient<GroupMember[]>(`/groups/${group.id}/members`);
      setGroupMembers(members);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load group members', 'error');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleAddMemberToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newMemberUserId.trim()) return;
    setIsAddingMember(true);

    try {
      await apiClient(`/groups/${selectedGroup.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: newMemberUserId.trim() }),
      });

      showToast('Member added to group', 'success');
      setNewMemberUserId('');
      const updatedMembers = await apiClient<GroupMember[]>(`/groups/${selectedGroup.id}/members`);
      setGroupMembers(updatedMembers);
      // Update group card count
      setGroups((prev) =>
        prev.map((g) =>
          g.id === selectedGroup.id ? { ...g, member_count: (g.member_count || 0) + 1 } : g
        )
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

      setGroupMembers((prev) => prev.filter((m) => m.user_id !== userId));
      setGroups((prev) =>
        prev.map((g) =>
          g.id === selectedGroup.id ? { ...g, member_count: Math.max(0, (g.member_count || 1) - 1) } : g
        )
      );
      showToast('Member removed from group', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Organization Groups</h1>
          <p className="text-xs text-slate-400 mt-1">
            Group members together (e.g. Legal, Finance, Engineering) to assign document access rules in bulk
          </p>
        </div>

        {isPrivileged && (
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Create Group
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading groups...</div>
      ) : groups.length === 0 ? (
        <Card className="text-center py-12">
          <UsersRound className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-200">No groups configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Create groups to grant batch access permissions for documents across multiple users.
          </p>
          {isPrivileged && (
            <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create Group
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card
              key={group.id}
              hoverEffect
              onClick={() => handleOpenGroupDetails(group)}
              className="cursor-pointer flex flex-col justify-between"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold text-slate-100 truncate">
                    {group.name}
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
                <span>Click to manage members</span>
                {isPrivileged && (
                  <button
                    onClick={(e) => handleDeleteGroup(group.id, e)}
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                    title="Delete group"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Organization Group"
        description="Establish a functional team group within this organization."
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <Input
            label="Group Name"
            placeholder="e.g. Legal & Compliance"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Description (Optional)"
            placeholder="e.g. Members responsible for reviewing regulatory contracts"
            value={groupDesc}
            onChange={(e) => setGroupDesc(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Create Group
            </Button>
          </div>
        </form>
      </Modal>

      {/* Group Members Modal */}
      <Modal
        isOpen={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        title={`Group: ${selectedGroup?.name}`}
        description="View and configure members belonging to this group."
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Add member form */}
          {isPrivileged && (
            <form onSubmit={handleAddMemberToGroup} className="flex gap-2">
              <Input
                placeholder="User ID (UUID) to add to group"
                value={newMemberUserId}
                onChange={(e) => setNewMemberUserId(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" size="sm" isLoading={isAddingMember}>
                <UserPlus className="w-4 h-4 mr-1.5" /> Add Member
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
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{gm.user?.full_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{gm.user?.email}</p>
                    </div>
                    {isPrivileged && (
                      <button
                        onClick={() => handleRemoveMemberFromGroup(gm.user_id)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                        title="Remove from group"
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
    </div>
  );
}
