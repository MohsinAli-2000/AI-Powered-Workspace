'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import type {
  AuditLog,
  AuditPagination,
  AuditLogFilterOptions,
} from '@/types/api.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import {
  ScrollText,
  Search,
  RefreshCw,
  Filter,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Code2,
  Calendar,
  User,
  Activity,
  Layers,
  Copy,
  Check,
} from 'lucide-react';

export default function AuditLogsPage() {
  const { showToast } = useToast();
  const { activeOrg } = useOrgStore();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<AuditPagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [filterOptions, setFilterOptions] = useState<AuditLogFilterOptions>({
    actions: [],
    resourceTypes: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedResourceType, setSelectedResourceType] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Metadata detail modal state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const isPrivileged = activeOrg?.role === 'OWNER' || activeOrg?.role === 'ADMIN';

  // Load distinct filter options (actions and resource types)
  const loadFilterOptions = useCallback(async () => {
    if (!activeOrg || !isPrivileged) return;
    try {
      const res = await apiClient<AuditLogFilterOptions>(
        `/organizations/${activeOrg.id}/audit-logs/filters`
      );
      if (res && Array.isArray(res.actions) && Array.isArray(res.resourceTypes)) {
        setFilterOptions(res);
      }
    } catch {
      // Non-fatal if filters fail
    }
  }, [activeOrg, isPrivileged]);

  // Load paginated audit logs
  const loadLogs = useCallback(async () => {
    if (!activeOrg || !isPrivileged) return;
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });

      if (selectedAction) queryParams.set('action', selectedAction);
      if (selectedResourceType) queryParams.set('resourceType', selectedResourceType);
      if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());

      const res = await apiClient<{
        data: AuditLog[];
        pagination: AuditPagination;
      }>(`/organizations/${activeOrg.id}/audit-logs?${queryParams.toString()}`);

      // API client unwraps envelope if needed
      if (res && Array.isArray((res as unknown as { data: AuditLog[] }).data)) {
        setLogs((res as unknown as { data: AuditLog[] }).data);
        if ((res as unknown as { pagination: AuditPagination }).pagination) {
          setPagination((res as unknown as { pagination: AuditPagination }).pagination);
        }
      } else if (Array.isArray(res)) {
        setLogs(res as unknown as AuditLog[]);
      } else {
        setLogs([]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load audit logs', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [
    activeOrg,
    isPrivileged,
    currentPage,
    pageSize,
    selectedAction,
    selectedResourceType,
    searchQuery,
    showToast,
  ]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadLogs();
  };

  const handleCopyMetadata = () => {
    if (!selectedLog?.metadata) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog.metadata, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getActionBadgeColor = (action: string) => {
    if (
      action.includes('created') ||
      action.includes('joined') ||
      action.includes('added') ||
      action.includes('uploaded')
    ) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (
      action.includes('updated') ||
      action.includes('transferred') ||
      action.includes('mode_updated') ||
      action.includes('rule_set')
    ) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    if (
      action.includes('deleted') ||
      action.includes('removed') ||
      action.includes('revoked')
    ) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
    return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
  };

  if (!isPrivileged) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Card className="border-rose-500/20 bg-rose-950/10 backdrop-blur-xl">
          <CardHeader className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <CardTitle className="text-xl text-slate-100">Access Restricted</CardTitle>
            <CardDescription className="text-slate-400 max-w-md mx-auto mt-2">
              Organization audit logs contain sensitive operational tracking and are restricted
              exclusively to Organization <strong>OWNER</strong> and <strong>ADMIN</strong> roles.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <ScrollText className="w-6 h-6 text-indigo-400" />
            Audit Logs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Immutable timeline of security events, administrative actions, and access rule mutations in{' '}
            <span className="text-slate-200 font-medium">{activeOrg?.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadFilterOptions();
              loadLogs();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 border-white/10 hover:bg-slate-900"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-white/5 bg-slate-900/40 backdrop-blur-xl">
        <CardContent className="p-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col md:flex-row items-stretch md:items-center gap-3"
          >
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by action, resource, actor name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-950/60 border-white/10 text-sm focus:border-indigo-500/50"
              />
            </div>

            {/* Action Filter */}
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                aria-label="Filter by action"
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-950/60 border border-white/10 text-xs text-slate-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500/50"
              >
                <option value="">All Actions</option>
                {filterOptions.actions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>

            {/* Resource Type Filter */}
            <div className="shrink-0">
              <select
                aria-label="Filter by resource type"
                value={selectedResourceType}
                onChange={(e) => {
                  setSelectedResourceType(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-950/60 border border-white/10 text-xs text-slate-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500/50"
              >
                <option value="">All Resources</option>
                {filterOptions.resourceTypes.map((resType) => (
                  <option key={resType} value={resType}>
                    {resType}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500 shrink-0">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Audit Logs Table Card */}
      <Card className="border-white/5 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-300">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-4 w-28 bg-white/5 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-36 bg-white/5 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 w-28 bg-white/5 rounded-full" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-24 bg-white/5 rounded" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-7 w-16 bg-white/5 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <ScrollText className="w-6 h-6" />
                    </div>
                    <p className="font-medium text-slate-300">No audit events found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery || selectedAction || selectedResourceType
                        ? 'Try adjusting your search query or filters.'
                        : 'Administrative events and mutations will appear here automatically.'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-800/20 transition-colors group"
                  >
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span title={new Date(log.created_at).toLocaleString()}>
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                    </td>

                    {/* Actor */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {log.actor ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-300 shrink-0">
                            {log.actor.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-200 leading-tight">
                              {log.actor.name}
                            </p>
                            <p className="text-[10px] text-slate-400 leading-tight">
                              {log.actor.email}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <User className="w-3.5 h-3.5" />
                          <span className="italic">System / Automated</span>
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={`font-mono text-[11px] px-2 py-0.5 border ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </Badge>
                    </td>

                    {/* Resource */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-300 capitalize">
                          {log.resource_type}
                        </span>
                        {log.resource_id && (
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[100px]">
                            #{log.resource_id.substring(0, 8)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Details Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="text-xs h-7 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                      >
                        <Code2 className="w-3.5 h-3.5 mr-1" />
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-white/5 bg-slate-950/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-slate-200 outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="ml-2">
              Showing{' '}
              <strong className="text-slate-200">
                {logs.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-200">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{' '}
              of <strong className="text-slate-200">{pagination.total}</strong> events
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoading}
                className="h-7 w-7 p-0 border-white/10"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage >= pagination.totalPages || isLoading}
                className="h-7 w-7 p-0 border-white/10"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Metadata Detail Modal */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Details"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-xl border border-white/5">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Action</span>
                <span className="text-slate-200 font-mono font-medium">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Resource</span>
                <span className="text-slate-200 font-medium capitalize">
                  {selectedLog.resource_type} ({selectedLog.resource_id ?? 'N/A'})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Timestamp</span>
                <span className="text-slate-200">{new Date(selectedLog.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Actor</span>
                <span className="text-slate-200">
                  {selectedLog.actor ? `${selectedLog.actor.name} (${selectedLog.actor.email})` : 'System'}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  Event Metadata Payload
                </span>
                {selectedLog.metadata && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyMetadata}
                    className="h-6 text-[10px] text-slate-400 hover:text-slate-200 px-2"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 mr-1 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy JSON
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-white/10 font-mono text-xs overflow-x-auto max-h-60 text-slate-300">
                {selectedLog.metadata ? (
                  <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                ) : (
                  <span className="text-slate-400 italic">No additional metadata recorded for this event.</span>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="border-white/10"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
