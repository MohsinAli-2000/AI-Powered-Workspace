'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { Invitation, OrganizationRole } from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import { Mail, UserPlus, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function InvitationsPage() {
  const { showToast } = useToast();
  const { activeOrg } = useOrgStore();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizationRole>('MEMBER');
  const [isSending, setIsSending] = useState(false);

  const isPrivileged = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';

  const loadInvitations = useCallback(async () => {
    if (!activeOrg) return;
    setIsLoading(true);
    try {
      const data = await apiClient<Invitation[]>(`/organizations/${activeOrg.id}/invitations`);
      setInvitations(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load invitations', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, showToast]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !email.trim()) return;
    setIsSending(true);

    try {
      const newInvite = await apiClient<Invitation>(`/organizations/${activeOrg.id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      });

      setInvitations((prev) => [newInvite, ...prev]);
      showToast(`Invitation sent to ${email}`, 'success');
      setIsInviteModalOpen(false);
      setEmail('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send invitation', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!activeOrg) return;

    try {
      await apiClient(`/organizations/${activeOrg.id}/invitations/${invitationId}`, {
        method: 'DELETE',
      });

      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      showToast('Invitation revoked.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to revoke invitation', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Organization Invitations</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track sent invitation links and revoke outstanding invites
          </p>
        </div>

        {isPrivileged && (
          <Button size="sm" onClick={() => setIsInviteModalOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            Send Invitation
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            Pending & Historical Invitations ({invitations.length})
          </CardTitle>
          <CardDescription>
            Recipients receive a 7-day cryptographically verified invitation link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading invitations...</div>
          ) : invitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No invitations pending. Click &quot;Send Invitation&quot; to invite a colleague.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400">
                    <th className="pb-3 font-medium">Invited Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Sent Date</th>
                    <th className="pb-3 font-medium">Expires</th>
                    {isPrivileged && <th className="pb-3 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 pr-4 font-semibold text-slate-200">{inv.email}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={inv.role === 'ADMIN' ? 'info' : 'default'}>
                          {inv.role}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {inv.status === 'PENDING' && (
                          <Badge variant="warning" className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> PENDING
                          </Badge>
                        )}
                        {inv.status === 'ACCEPTED' && (
                          <Badge variant="success" className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> ACCEPTED
                          </Badge>
                        )}
                        {(inv.status === 'REVOKED' || inv.status === 'REJECTED') && (
                          <Badge variant="danger" className="flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> {inv.status}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-400">{formatDate(inv.created_at)}</td>
                      <td className="py-3 pr-4 text-slate-400">{formatDate(inv.expires_at)}</td>
                      {isPrivileged && (
                        <td className="py-3 text-right">
                          {inv.status === 'PENDING' && (
                            <button
                              onClick={() => handleRevoke(inv.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Revoke invitation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Send Invitation Link"
        description="Invite a new team member by email."
      >
        <form onSubmit={handleSendInvite} className="space-y-4">
          <Input
            type="email"
            label="Email Address"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OrganizationRole)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="MEMBER">MEMBER (Standard Access)</option>
              <option value="ADMIN">ADMIN (Administrative Access)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsInviteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSending}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
