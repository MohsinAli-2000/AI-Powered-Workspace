'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useOrgStore } from '@/stores/org.store';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import { OrganizationMember, OrganizationRole } from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState, LoadingState } from '@/components/ui/state';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import { Users, UserPlus, Trash2, Shield, UserCheck, AlertTriangle, Search } from 'lucide-react';

export default function MembersPage() {
  const { showToast } = useToast();
  const { user: currentUser } = useAuthStore();
  const { activeOrg } = useOrgStore();
  const orgId = activeOrg?.id;

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('MEMBER');
  const [isInviting, setIsInviting] = useState(false);

  // Remove Modal State
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const isPrivileged = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';
  // The API only lets the OWNER remove members.
  const canRemove = activeOrg?.role === 'OWNER';

  const loadMembers = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient<OrganizationMember[]>(`/organizations/${orgId}/members`);
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter(
      (m) =>
        (m.user?.full_name || '').toLowerCase().includes(query) ||
        (m.user?.email || '').toLowerCase().includes(query)
    );
  }, [members, search]);

  const handleCloseInvite = () => {
    setIsInviteModalOpen(false);
    setInviteEmail('');
    setInviteRole('MEMBER');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !inviteEmail.trim()) return;
    setIsInviting(true);

    try {
      await apiClient(`/organizations/${orgId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      showToast(`Invitation sent to ${inviteEmail.trim()}`, 'success');
      handleCloseInvite();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send invitation', 'error');
    } finally {
      setIsInviting(false);
    }
  };

  const handleChangeRole = async (memberId: string, userId: string, newRole: OrganizationRole) => {
    if (!orgId) return;

    try {
      await apiClient(`/organizations/${orgId}/members/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      showToast('Member role updated successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to change role', 'error');
    }
  };

  const handleRemoveMember = async () => {
    if (!orgId || !memberToRemove) return;
    setIsRemoving(true);

    try {
      await apiClient(`/organizations/${orgId}/members/${memberToRemove.user_id}`, {
        method: 'DELETE',
      });

      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      showToast(`Removed ${memberToRemove.user?.full_name || 'member'} from organization`, 'info');
      setMemberToRemove(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Organization Members"
        description="Everyone who belongs to this organization. Admins can invite colleagues and change roles; project access is managed inside each project."
        actions={
          isPrivileged ? (
            <>
              <Link href="/settings/invitations">
                <Button size="sm" variant="ghost">View invitations</Button>
              </Link>
              <Button size="sm" onClick={() => setIsInviteModalOpen(true)}>
                <UserPlus className="w-4 h-4 mr-1.5" />
                Invite Member
              </Button>
            </>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Team Directory ({members.length})
              </CardTitle>
              <CardDescription>
                Members have access to authorized projects and shared documents according to access rules
              </CardDescription>
            </div>
            {members.length > 5 && (
              <div className="w-full sm:w-60">
                <Input
                  aria-label="Search members"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState message="Loading members..." />
          ) : loadError ? (
            <ErrorState title="Couldn't load members" message={loadError} onRetry={() => void loadMembers()} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400">
                    <th className="pb-3 font-medium">Member</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Joined Date</th>
                    {canRemove && <th className="pb-3 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={canRemove ? 5 : 4} className="py-8 text-center text-slate-400">
                        {members.length === 0 ? 'No members found.' : `No members match "${search}".`}
                      </td>
                    </tr>
                  )}
                  {filteredMembers.map((member) => {
                    const isSelf = member.user_id === currentUser?.id;
                    const isMemberOwner = member.role === 'OWNER';

                    return (
                      <tr key={member.id ?? member.user_id} className="hover:bg-white/[0.02]">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                              {(member.user?.full_name || member.user?.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-200">
                                {member.user?.full_name}
                              </span>
                              {isSelf && (
                                <span className="ml-1.5 text-[10px] text-slate-400">(You)</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-400 font-mono text-[11px]">
                          {member.user?.email}
                        </td>
                        <td className="py-3 pr-4">
                          {isPrivileged && !isMemberOwner && !isSelf ? (
                            <select
                              aria-label={`Role for ${member.user?.full_name}`}
                              value={member.role}
                              onChange={(e) =>
                                handleChangeRole(
                                  member.id,
                                  member.user_id,
                                  e.target.value as OrganizationRole
                                )
                              }
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="MEMBER">MEMBER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          ) : (
                            <Badge
                              variant={
                                isMemberOwner ? 'brand' : member.role === 'ADMIN' ? 'info' : 'default'
                              }
                            >
                              {member.role}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">
                          {formatDate(member.joined_at)}
                        </td>
                        {canRemove && (
                          <td className="py-3 text-right">
                            {!isMemberOwner && !isSelf && (
                              <button
                                type="button"
                                onClick={() => setMemberToRemove(member)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Remove member"
                                aria-label={`Remove ${member.user?.full_name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={handleCloseInvite}
        title="Invite Member to Organization"
        description="They will receive an email invitation to join this organization."
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <Input
            type="email"
            label="Colleague Email Address"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            autoFocus
          />

          <div>
            <span className="block text-xs font-medium text-slate-300 mb-1.5">
              Assigned Organization Role
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInviteRole('MEMBER')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  inviteRole === 'MEMBER'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-white/5 bg-slate-900/60 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">MEMBER</span>
                  {inviteRole === 'MEMBER' && <UserCheck className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Standard access to assigned projects and allowed documents.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setInviteRole('ADMIN')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  inviteRole === 'ADMIN'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-white/5 bg-slate-900/60 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">ADMIN</span>
                  {inviteRole === 'ADMIN' && <Shield className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Can invite members, manage groups, and administer all projects.
                </p>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseInvite}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isInviting}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        title="Remove Organization Member"
        description="Revoke this user's access to the organization."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">
                Are you sure you want to remove {memberToRemove?.user?.full_name}?
              </p>
              <p className="mt-1 text-[11px] text-rose-300/80">
                This member will immediately lose access to all projects, documents, and conversation histories associated with this organization.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setMemberToRemove(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={isRemoving}
              onClick={handleRemoveMember}
            >
              Confirm Removal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
