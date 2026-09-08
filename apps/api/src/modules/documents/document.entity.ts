/**
 * Access mode defining who within the project or organization can view the document.
 * Maps to PostgreSQL enum `document_access_mode`.
 */
export type DocumentAccessMode = 'PROJECT' | 'RESTRICTED';

/**
 * Processing status of a document version.
 * Maps to PostgreSQL enum `document_version_status`.
 */
export type DocumentVersionStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

/**
 * Database row shape for the `documents` table.
 */
export interface Document {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  description: string | null;
  access_mode: DocumentAccessMode;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Database row shape for the `document_versions` table.
 */
export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  content_hash: string;
  status: DocumentVersionStatus;
  is_current: boolean;
  created_by: string | null;
  created_at: Date;
  processed_at: Date | null;
  updated_at: Date;
}

/**
 * Enriched document representation returned by API endpoints,
 * including current version metadata and processing status.
 */
export interface DocumentWithCurrentVersion extends Document {
  current_version_id: string;
  version_number: number;
  status: DocumentVersionStatus;
  mime_type: string;
  file_size: number;
  original_filename: string;
  creator_name?: string | null;
}
