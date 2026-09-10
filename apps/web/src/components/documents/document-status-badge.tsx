import React from 'react';
import { DocumentVersionStatus } from '@/types/api.types';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export const DocumentStatusBadge: React.FC<{ status?: DocumentVersionStatus }> = ({ status }) => {
  switch (status) {
    case 'READY':
      return (
        <Badge variant="success" className="gap-1 font-medium">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          READY
        </Badge>
      );
    case 'PROCESSING':
      return (
        <Badge variant="info" className="gap-1 font-medium animate-pulse">
          <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />
          PROCESSING
        </Badge>
      );
    case 'QUEUED':
      return (
        <Badge variant="warning" className="gap-1 font-medium">
          <Clock className="w-3 h-3 text-amber-400" />
          QUEUED
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge variant="danger" className="gap-1 font-medium">
          <AlertCircle className="w-3 h-3 text-rose-400" />
          FAILED
        </Badge>
      );
    default:
      return <Badge variant="default">UNKNOWN</Badge>;
  }
};
