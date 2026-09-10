'use client';

import React, { useState } from 'react';
import { DocumentItem } from '@/types/api.types';
import { DocumentStatusBadge } from './document-status-badge';
import { AccessRulesDialog } from './access-rules-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatBytes, formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
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

  const getFileIcon = (mimeType: string, name: string) => {
    if (mimeType.includes('pdf') || name.endsWith('.pdf')) {
      return <FileText className="w-4 h-4 text-rose-400" />;
    }
    if (mimeType.includes('sheet') || mimeType.includes('excel') || name.endsWith('.xlsx')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    }
    if (mimeType.includes('presentation') || name.endsWith('.pptx')) {
      return <FileText className="w-4 h-4 text-amber-400" />;
    }
    return <FileCode className="w-4 h-4 text-indigo-400" />;
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const data = await apiClient<{ download_url?: string }>(`/documents/${doc.id}/download`);
      if (data.download_url) {
        window.open(data.download_url, '_blank');
      } else {
        window.open(`http://localhost:5000/api/v1/documents/${doc.id}/download`, '_blank');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'error');
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!confirm(`Are you sure you want to delete "${doc.name}"? Searchable vector chunks will be deleted.`)) {
      return;
    }

    try {
      await apiClient(`/documents/${doc.id}`, { method: 'DELETE' });
      showToast(`Document "${doc.name}" deleted.`, 'info');
      onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
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
      <div className="border border-white/5 rounded-2xl overflow-hidden bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 bg-white/[0.01]">
                <th className="py-3 px-4 font-medium">Document Name</th>
                <th className="py-3 px-4 font-medium">Size</th>
                <th className="py-3 px-4 font-medium">Processing Status</th>
                <th className="py-3 px-4 font-medium">Access Mode</th>
                <th className="py-3 px-4 font-medium">Uploaded</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/5 flex items-center justify-center shrink-0">
                        {getFileIcon(doc.mime_type, doc.name)}
                      </div>
                      <div className="truncate max-w-xs sm:max-w-md">
                        <p className="font-semibold text-slate-100 truncate">{doc.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">ID: {doc.id.substring(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                    {doc.file_size ? formatBytes(doc.file_size) : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <DocumentStatusBadge status={doc.status} />
                  </td>
                  <td className="py-3.5 px-4">
                    {doc.access_mode === 'RESTRICTED' ? (
                      <Badge variant="warning" className="gap-1">
                        <Lock className="w-3 h-3 text-amber-400" /> RESTRICTED
                      </Badge>
                    ) : (
                      <Badge variant="brand" className="gap-1">
                        <Globe className="w-3 h-3 text-indigo-400" /> PROJECT
                      </Badge>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">{formatDate(doc.created_at)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Download Document"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {canManage && (
                        <button
                          onClick={() => setSelectedDocForRules(doc)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Manage Access Control Rules"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canManage && (
                        <button
                          onClick={() => handleDelete(doc)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete Document"
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
    </>
  );
};
