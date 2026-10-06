'use client';

import React, { useMemo, useState } from 'react';
import { DocumentItem } from '@/types/api.types';
import { DocumentStatusBadge } from './document-status-badge';
import { AccessRulesDialog } from './access-rules-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatBytes, formatDate } from '@/lib/utils';
import { apiClient, downloadFile } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  Download,
  Trash2,
  Lock,
  Globe,
  Shield,
  Pencil,
  Search,
} from 'lucide-react';

interface DocumentTableProps {
  documents: DocumentItem[];
  isLoading: boolean;
  onRefresh: () => void;
  canManage: boolean;
}

export const DocumentTable: React.FC<DocumentTableProps> = ({
  documents,
  isLoading,
  onRefresh,
  canManage,
}) => {
  const { showToast } = useToast();
  const [selectedDocForRules, setSelectedDocForRules] = useState<DocumentItem | null>(null);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Rename
  const [docToRename, setDocToRename] = useState<DocumentItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((d) => d.name.toLowerCase().includes(query));
  }, [documents, search]);

  const getFileIcon = (mimeType: string | undefined, name: string) => {
    const mime = mimeType || '';
    const lowerName = name.toLowerCase();
    if (mime.includes('pdf') || lowerName.endsWith('.pdf')) {
      return <FileText className="w-4 h-4 text-rose-400" />;
    }
    if (mime.includes('sheet') || mime.includes('excel') || lowerName.endsWith('.xlsx')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    }
    if (mime.includes('presentation') || lowerName.endsWith('.pptx')) {
      return <FileText className="w-4 h-4 text-amber-400" />;
    }
    return <FileCode className="w-4 h-4 text-indigo-400" />;
  };

  const handleDownload = async (doc: DocumentItem) => {
    setDownloadingId(doc.id);
    try {
      await downloadFile(`/documents/${doc.id}/download`, doc.name);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const openRename = (doc: DocumentItem) => {
    setDocToRename(doc);
    setRenameValue(doc.name);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docToRename || !renameValue.trim()) return;
    if (renameValue.trim() === docToRename.name) {
      setDocToRename(null);
      return;
    }
    setIsRenaming(true);
    try {
      await apiClient(`/documents/${docToRename.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      showToast('Document renamed', 'success');
      setDocToRename(null);
      onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rename failed', 'error');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient(`/documents/${docToDelete.id}`, { method: 'DELETE' });
      showToast(`Document "${docToDelete.name}" deleted.`, 'info');
      setDocToDelete(null);
      onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading documents...</div>;
  }

  if (documents.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 border border-white/5 rounded-2xl bg-slate-900/30">
        No documents uploaded to this project yet. Use the upload area above to get started.
      </div>
    );
  }

  return (
    <>
      {documents.length > 5 && (
        <div className="max-w-sm">
          <Input
            aria-label="Search documents"
            placeholder="Search documents by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      )}

      <div className="border border-white/5 rounded-2xl overflow-hidden bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 bg-white/[0.01]">
                <th className="py-3 px-4 font-medium">Document</th>
                <th className="py-3 px-4 font-medium">Size</th>
                <th className="py-3 px-4 font-medium">Processing Status</th>
                <th className="py-3 px-4 font-medium">Who can see it</th>
                <th className="py-3 px-4 font-medium">Uploaded</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No documents match &quot;{search}&quot;.
                  </td>
                </tr>
              )}
              {filteredDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/5 flex items-center justify-center shrink-0">
                        {getFileIcon(doc.mime_type, doc.name)}
                      </div>
                      <div className="truncate max-w-xs sm:max-w-md">
                        <p className="font-semibold text-slate-100 truncate" title={doc.name}>{doc.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {doc.version_number ? `Version ${doc.version_number}` : ''}
                          {doc.version_number && doc.creator_name ? ' · ' : ''}
                          {doc.creator_name ? `by ${doc.creator_name}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    {doc.file_size ? formatBytes(doc.file_size) : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <DocumentStatusBadge status={doc.status} />
                  </td>
                  <td className="py-3.5 px-4">
                    {doc.access_mode === 'RESTRICTED' ? (
                      <Badge variant="warning" className="gap-1" title="Only people explicitly allowed by access rules">
                        <Lock className="w-3 h-3 text-amber-400" /> Restricted
                      </Badge>
                    ) : (
                      <Badge variant="brand" className="gap-1" title="Everyone with access to this project">
                        <Globe className="w-3 h-3 text-indigo-400" /> Whole project
                      </Badge>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">{formatDate(doc.created_at)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="Download document"
                        aria-label={`Download ${doc.name}`}
                      >
                        <Download className={`w-3.5 h-3.5 ${downloadingId === doc.id ? 'animate-pulse' : ''}`} />
                      </button>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openRename(doc)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Rename document"
                          aria-label={`Rename ${doc.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setSelectedDocForRules(doc)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Manage who can access this document"
                          aria-label={`Manage access to ${doc.name}`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setDocToDelete(doc)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete document"
                          aria-label={`Delete ${doc.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AccessRulesDialog
        documentItem={selectedDocForRules}
        onClose={() => setSelectedDocForRules(null)}
        onUpdated={onRefresh}
      />

      {/* Rename dialog */}
      <Modal
        isOpen={!!docToRename}
        onClose={() => setDocToRename(null)}
        title="Rename document"
        description="Changes the display name only; the file content stays the same."
      >
        <form onSubmit={handleRename} className="space-y-4">
          <Input
            label="Document name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={255}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDocToRename(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isRenaming}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!docToDelete}
        title="Delete document?"
        message={
          <>
            <strong className="text-white break-all">{docToDelete?.name}</strong> and its searchable
            vector chunks will be permanently deleted. The AI assistant will no longer cite it.
          </>
        }
        confirmLabel="Delete document"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDocToDelete(null)}
      />
    </>
  );
};
