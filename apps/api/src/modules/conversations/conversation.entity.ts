export interface Conversation {
  id: string;
  organization_id: string;
  created_by: string;
  title: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationProject {
  conversation_id: string;
  project_id: string;
  organization_id: string;
}

export interface ConversationWithProjects extends Conversation {
  project_ids: string[];
}

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: Date;
}

export interface MessageSource {
  id: string;
  message_id: string;
  document_chunk_id: string;
  rank: number;
  similarity_score: number;
  created_at: Date;
}

export interface SourceCitation {
  chunk_id: string;
  document_id: string;
  document_name: string;
  project_id: string;
  project_name: string;
  chunk_index: number;
  page_number: number | null;
  similarity_score: number;
  excerpt: string;
}

export interface MessageWithSources extends Message {
  sources?: SourceCitation[];
}

export interface RetrievedChunk {
  chunk_id: string;
  content: string;
  chunk_index: number;
  page_number: number | null;
  document_id: string;
  document_name: string;
  project_id: string;
  project_name: string;
  similarity: number;
}
