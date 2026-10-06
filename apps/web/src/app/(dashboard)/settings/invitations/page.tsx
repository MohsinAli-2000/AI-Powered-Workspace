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
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState, LoadingState } from '@/components/ui/state';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import { Mail, UserPlus, Trash2, Clock, CheckCircle, XCircle, RefreshCw, ShieldAlert } from 'lucide-react';

export default function InvitationsPage() {
  const { showToast } = useToast();
  const { activeOrg } = useOrgStore();
  const orgId = activeOrg?.id;

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Timestamp of the last successful load, used to flag pending invitations that have since expired.
  const [loadedAt, setLoadedAt] = useState(0);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizationRole>('MEMBER');
  const [isSending, setIsSending] = useState(false);

  const [inviteToRevoke, setInviteToRevoke] = useState<Invitation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const isPrivileged = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';

  const loadInvitations = useCallback(async () => {
    if (!orgId || !isPrivileged) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient<Invitation[]>(`/organizations/${orgId}/invitations`);
      setInvitations(Array.isArray(data) ? data : []);
      setLoadedAt(Date.now());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, isPrivileged]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const handleCloseInvite = () => {
    setIsInviteModalOpen(false);
    setEmail('');
    setRole('MEMBER');
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !email.trim()) return;
    setIsSending(true);

    try {
      await apiClient<Invitation>(`/organizations/${orgId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      });

      showToast(`Invitation sent to ${email.trim()}`, 'success');
      handleCloseInvite();
      // Reload so the list reflects exactly what the server stored (status, expiry, inviter).
      await loadInvitations();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send invitation', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleRevoke = async () => {
    if (!orgId || !inviteToRevoke) return;
    setIsRevoking(true);

    try {
      await apiClient(`/organizations/${orgId}/invitations/${inviteToRevoke.id}`, {
        method: 'DELETE',
      });

      setInvitations((prev) =>
        prev.map((inv) => (inv.id === inviteToRevoke.id ? { ...inv, status: 'REVOKED' } : inv))
      );
      showToast('Invitation revoked.', 'info');
      setInviteToRevoke(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to revoke invitation', 'error');
    } finally {
      setIsRevoking(false);
    }
  };

  const renderStatus = (inv: Invitation) => {
    // A pending invite past its expiry date can no longer be accepted.
    const status =
      inv.status === 'PENDING' && loadedAt > 0 && new Date(inv.expires_at).getTime() < loadedAt ? 'EXPIRED' : inv.status;

    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="w-3 h-3" /> PENDING
          </Badge>
        );
      case 'ACCEPTED':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="w-3 h-3" /> ACCEPTED
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" /> EXPIRED
          </Badge>
        );
      default:
        return (
          <Badge variant="danger" className="gap-1">
            <XCircle className="w-3 h-3" /> {status}
          </Badge>
        );
    }
  };

  if (!isPrivileged) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <Card className="text-center py-12 px-6 border-rose-500/20">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-100">Administrators only</h2>
          <p className="text-xs text-slate-400 mt-1">
            Only organization OWNERs and ADMINs can send and manage invitations.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Organization Invitations"
        description="Invite colleagues by email. They receive a link valid for 7 days; once they accept, they appear under Members."
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => void loadInvitations()} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setIsInviteModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-1.5" />
              Send Invitation
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            Pending &amp; Historical Invitations ({invitations.length})
          </CardTitle>
          <CardDescription>
            Revoke a pending invitation at any time to invalidate its link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState message="Loading invitations..." />
          ) : loadError ? (
            <ErrorState title="Couldn't load invitations" message={loadError} onRetry={() => void loadInvitations()} />
          ) : invitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No invitations yet. Click &quot;Send Invitation&quot; to invite a colleague.
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
                    <th className="pb-3 font-medium text-right">Actions</th>
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
                      <td className="py-3 pr-4">{renderStatus(inv)}</td>
                      <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">{formatDate(inv.created_at)}</td>
                      <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">{formatDate(inv.expires_at)}</td>
                      <td className="py-3 text-right">
                        {inv.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => setInviteToRevoke(inv)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Revoke invitation"
                            aria-label={`Revoke invitation for ${inv.email}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
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
        onClose={handleCloseInvite}
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

          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as OrganizationRole)}
          >
            <option value="MEMBER">MEMBER (standard access)</option>
            <option value="ADMIN">ADMIN (administrative access)</option>
          </Select>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseInvite}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSending}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!inviteToRevoke}
        title="Revoke invitation?"
        message={
          <>
            The invitation for <strong className="text-white">{inviteToRevoke?.email}</strong> will stop working.
            You can send a new one later.
          </>
        }
        confirmLabel="Revoke"
        isLoading={isRevoking}
        onConfirm={handleRevoke}
        onCancel={() => setInviteToRevoke(null)}
      />
    </div>
  );
}
