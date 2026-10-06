'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient, ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state';
import type {
  AdminPlatformStats,
  AdminOrganizationSummary,
} from '@/types/api.types';
import {
  Shield,
  Building2,
  Users,
  FileText,
  HardDrive,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Ban,
  ArrowRight,
  Info,
  Calendar,
  Lock,
  Trash2,
  Mail,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function PlatformAdminPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();

  const [stats, setStats] = useState<AdminPlatformStats | null>(null);
  const [organizations, setOrganizations] = useState<AdminOrganizationSummary[]>([]);
  const [totalOrgs, setTotalOrgs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suspend modal state
  const [suspendingOrg, setSuspendingOrg] = useState<AdminOrganizationSummary | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Reactivate dialog state
  const [reactivatingOrg, setReactivatingOrg] = useState<AdminOrganizationSummary | null>(null);

  // Delete modal state
  const [deletingOrg, setDeletingOrg] = useState<AdminOrganizationSummary | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');


  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient<AdminPlatformStats>('/admin/stats');
      setStats(res);
    } catch (err) {
      console.error('Failed to load platform stats', err);
    }
  }, []);

  const fetchOrganizations = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await apiClient<{
        data: AdminOrganizationSummary[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/admin/organizations?${params.toString()}`);

      // apiClient returns { data, pagination } when pagination exists in envelope
      const list = Array.isArray(res?.data) ? res.data : [];
      setOrganizations(list);
      setTotalOrgs(res?.pagination?.total ?? list.length);
      setTotalPages(res?.pagination?.totalPages ?? 1);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load organizations';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (user?.is_platform_admin) {
      fetchStats();
    }
  }, [user?.is_platform_admin, fetchStats]);

  useEffect(() => {
    if (user?.is_platform_admin) {
      fetchOrganizations();
    }
  }, [user?.is_platform_admin, fetchOrganizations]);

  const handleSuspendSubmit = async () => {
    if (!suspendingOrg) return;
    setIsSubmittingAction(true);
    try {
      await apiClient(`/admin/organizations/${suspendingOrg.id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: suspensionReason.trim() || undefined }),
      });
      showToast(`Suspended access for "${suspendingOrg.name}"`, 'success');
      setSuspendingOrg(null);
      setSuspensionReason('');
      fetchOrganizations(true);
      fetchStats();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to suspend organization';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReactivateSubmit = async () => {
    if (!reactivatingOrg) return;
    setIsSubmittingAction(true);
    try {
      await apiClient(`/admin/organizations/${reactivatingOrg.id}/reactivate`, {
        method: 'POST',
      });
      showToast(`Reactivated access for "${reactivatingOrg.name}"`, 'success');
      setReactivatingOrg(null);
      fetchOrganizations(true);
      fetchStats();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to reactivate organization';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingOrg) return;
    setIsSubmittingAction(true);
    try {
      await apiClient(`/admin/organizations/${deletingOrg.id}`, {
        method: 'DELETE',
      });
      showToast(
        `Permanently deleted "${deletingOrg.name}" and purged all associated data`,
        'success'
      );
      setDeletingOrg(null);
      setDeleteConfirmText('');
      fetchOrganizations(true);
      fetchStats();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete organization';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };


  // If user is not platform admin, guard the view
  if (!user?.is_platform_admin) {
    return (
      <div className="py-16 max-w-lg mx-auto">
        <Card className="text-center p-8 border-amber-500/20 bg-amber-500/5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white mb-2">Platform Admin Access Required</h2>
          <p className="text-xs text-slate-300 mb-6 leading-relaxed">
            This dashboard is reserved for the product owner. If you are the platform administrator,
            grant access using the CLI tool in your terminal:
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-white/10 font-mono text-[11px] text-amber-300 text-left mb-6 overflow-x-auto">
            npm run platform-admin -- grant {user?.email || 'your-email@example.com'}
          </div>
          <Link href="/dashboard">
            <Button variant="secondary" size="sm">
              Return to Workspace
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Platform Administration"
        description="Monitor organizations, track system utilization, and enforce compliance while preserving tenant privacy."
        badges={
          <Badge variant="warning" className="flex items-center gap-1 font-semibold">
            <Shield className="w-3 h-3" /> Product Owner
          </Badge>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchStats();
              fetchOrganizations(true);
            }}
            disabled={isRefreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Privacy Guarantee Notice */}
      <Notice variant="info" title="Zero-Knowledge Privacy Boundary Enforced">
        Platform administrators have access to organization-level metadata and aggregate metrics only (names,
        owner contact info, storage sizes, and document counts). Customer document text, files, RAG embeddings,
        and chat conversations are strictly isolated and never visible from this dashboard.
      </Notice>

      {/* High-Level Utilization Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-slate-900/40 border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Organizations
              </span>
              <Building2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{stats.total_organizations}</span>
              <span className="text-[11px] text-emerald-400 font-medium">
                {stats.active_organizations} active
              </span>
              {stats.suspended_organizations > 0 && (
                <span className="text-[11px] text-rose-400 font-medium">
                  • {stats.suspended_organizations} suspended
                </span>
              )}
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/40 border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Total Users
              </span>
              <Users className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.total_users}</div>
          </Card>

          <Card className="p-4 bg-slate-900/40 border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Indexed Documents
              </span>
              <FileText className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.total_documents}</div>
          </Card>

          <Card className="p-4 bg-slate-900/40 border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Storage Used
              </span>
              <HardDrive className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {formatBytes(stats.total_storage_bytes)}
            </div>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-slate-900/40 border-white/5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by organization name or owner email..."
              className="pl-9 bg-slate-950/60 border-white/10 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Status:</span>
            {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={statusFilter === filter ? 'primary' : 'ghost'}
                onClick={() => {
                  setStatusFilter(filter);
                  setPage(1);
                }}
                className="text-xs h-8 px-2.5"
              >
                {filter === 'ALL' ? 'All' : filter === 'ACTIVE' ? 'Active' : 'Suspended'}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Organization Listing Table */}
      {isLoading ? (
        <LoadingState message="Loading organizations..." />
      ) : error ? (
        <ErrorState title="Failed to load organizations" message={error} onRetry={() => fetchOrganizations()} />
      ) : organizations.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-8 h-8" />}
          title="No organizations found"
          description={
            search || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or status filter.'
              : 'No organizations have been created on the platform yet.'
          }
          action={
            (search || statusFilter !== 'ALL') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                }}
              >
                Clear Filters
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden border-white/10 bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-900/60 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Primary Owner</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Utilization</th>
                  <th className="py-3 px-4 text-right">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {organizations.map((org) => {
                  const isSuspended = org.status === 'SUSPENDED';

                  return (
                    <tr
                      key={org.id}
                      className={`hover:bg-slate-900/40 transition-colors ${
                        isSuspended ? 'bg-rose-500/[0.02]' : ''
                      }`}
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate max-w-[180px] sm:max-w-[240px]">{org.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[220px]">
                          ID: {org.id}
                        </p>
                      </td>

                      {/* Owner Contact */}
                      <td className="py-3.5 px-4">
                        {org.owner_email ? (
                          <div>
                            <p className="font-medium text-slate-200 truncate max-w-[180px]">
                              {org.owner_name || 'Owner'}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                              {org.owner_email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No owner assigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isSuspended ? (
                          <div>
                            <Badge variant="danger" className="inline-flex items-center gap-1 font-semibold">
                              <Ban className="w-3 h-3" /> Suspended
                            </Badge>
                            {org.suspension_reason && (
                              <p
                                className="text-[10px] text-rose-300/80 mt-1 max-w-[160px] truncate mx-auto"
                                title={`Reason: ${org.suspension_reason}`}
                              >
                                {org.suspension_reason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="success" className="inline-flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </Badge>
                        )}
                      </td>

                      {/* Aggregate Utilization */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="text-slate-300 font-mono text-[11px]">
                          {org.document_count} docs • {formatBytes(org.storage_bytes)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {org.member_count} member{org.member_count === 1 ? '' : 's'} • {org.project_count} project{org.project_count === 1 ? '' : 's'}
                        </div>
                      </td>

                      {/* Created date */}
                      <td className="py-3.5 px-4 text-right text-slate-400 text-[11px] whitespace-nowrap">
                        {formatDate(org.created_at)}
                      </td>

                      {/* Enforcement Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isSuspended ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => setReactivatingOrg(org)}
                              className="text-xs h-7 px-2.5 font-medium"
                            >
                              Reactivate
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setDeletingOrg(org);
                                setDeleteConfirmText('');
                              }}
                              className="text-xs h-7 px-2 font-medium flex items-center gap-1"
                              title="Permanently delete suspended organization and purge all data"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setSuspendingOrg(org);
                              setSuspensionReason('');
                            }}
                            className="text-xs h-7 px-2.5 font-medium"
                          >
                            Suspend
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-white/5 bg-slate-900/30 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing {organizations.length} of {totalOrgs} organization{totalOrgs === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 text-xs px-2.5"
                >
                  Previous
                </Button>
                <span className="text-[11px] font-mono px-1">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 text-xs px-2.5"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Suspend Confirmation Modal */}
      <Modal
        isOpen={Boolean(suspendingOrg)}
        onClose={() => {
          if (!isSubmittingAction) {
            setSuspendingOrg(null);
            setSuspensionReason('');
          }
        }}
        title={`Suspend "${suspendingOrg?.name}"?`}
        maxWidth="md"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200 leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-100 mb-0.5">Impact on Organization Members</p>
              Suspending this organization immediately blocks all members from accessing its projects,
              uploading documents, and querying the AI assistant.
              <p className="mt-1 font-medium text-emerald-300">
                ✓ All document files, embeddings, and chat histories are safely preserved and not deleted.
              </p>
              <p className="mt-1 font-medium text-amber-300 flex items-center gap-1">
                <Mail className="w-3 h-3 shrink-0" />
                An email notice will be sent to the owner ({suspendingOrg?.owner_email || 'owner'}).
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Reason for Suspension (optional, sent to owner and logged)
            </label>
            <textarea
              rows={3}
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              placeholder="e.g. Terms of Service violation, non-payment, suspicious activity..."
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              disabled={isSubmittingAction}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSuspendingOrg(null);
                setSuspensionReason('');
              }}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleSuspendSubmit}
              isLoading={isSubmittingAction}
              className="flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              Confirm Suspension
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(reactivatingOrg)}
        title={`Reactivate "${reactivatingOrg?.name}"?`}
        message={
          <div>
            <p>
              This will restore full access for all members of <strong>{reactivatingOrg?.name}</strong>.
            </p>
            <p className="mt-2 text-slate-400">
              Members will immediately be able to resume searching knowledge, accessing projects, and using AI chats.
            </p>
          </div>
        }
        confirmLabel="Reactivate Organization"
        cancelLabel="Cancel"
        variant="primary"
        isLoading={isSubmittingAction}
        onConfirm={handleReactivateSubmit}
        onCancel={() => setReactivatingOrg(null)}
      />

      {/* Permanent Delete Modal for Suspended Organization */}
      <Modal
        isOpen={Boolean(deletingOrg)}
        onClose={() => {
          if (!isSubmittingAction) {
            setDeletingOrg(null);
            setDeleteConfirmText('');
          }
        }}
        title={`Permanently Delete "${deletingOrg?.name}"?`}
        maxWidth="md"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200 leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-100 mb-1">Irreversible Data Purge</p>
              <p>
                Deleting this suspended organization will <strong>permanently purge all data</strong>. This action cannot be undone:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300 font-normal">
                <li>All documents, chunked text, and vector embeddings in PostgreSQL.</li>
                <li>
                  All raw files ({deletingOrg ? formatBytes(deletingOrg.storage_bytes) : '0 B'}) permanently purged from object storage.
                </li>
                <li>All projects, groups, invitations, and conversation histories.</li>
              </ul>
              <p className="mt-2.5 text-amber-300 font-medium flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                A permanent deletion notice will be emailed to {deletingOrg?.owner_email || 'the owner'}.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              To confirm, type <span className="text-white font-mono font-bold">{deletingOrg?.name}</span> below:
            </label>
            <Input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deletingOrg?.name}
              className="w-full text-xs"
              disabled={isSubmittingAction}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeletingOrg(null);
                setDeleteConfirmText('');
              }}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteSubmit}
              isLoading={isSubmittingAction}
              disabled={deleteConfirmText.trim() !== deletingOrg?.name.trim()}
              className="flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Purge & Delete Organization
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

