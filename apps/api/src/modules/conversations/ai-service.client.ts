import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { AiClient } from './ai-client.js';

export interface RemoteRagQueryRequest {
  question: string;
  organization_id: string;
  user_id?: string;
  is_org_owner?: boolean;
  authorized_project_ids?: string[];
  conversation_history?: Array<{ role: string; content: string }>;
  similarity_threshold?: number;
  top_k?: number;
}

export interface RemoteSourceCitation {
  document_id: string;
  document_name: string;
  project_id: string;
  project_name: string;
  chunk_index: number;
  page_number?: number | null;
  similarity: number;
  excerpt: string;
}

export interface RemoteRagQueryResponse {
  answer: string;
  sources: RemoteSourceCitation[];
  insufficient_information: boolean;
  latency_ms: number;
}

/**
 * HTTP Client communicating with the Python FastAPI AI Service.
 */
export class FastApiAiServiceClient implements AiClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = env.AI_SERVICE_URL.replace(/\/$/, '');
  }

  /**
   * Health check to verify AI Service readiness.
   */
  public async checkHealth(): Promise<{ status: string; service: string }> {
    const resp = await fetch(`${this.baseUrl}/health`);
    if (!resp.ok) {
      throw new Error(`AI Service health check failed with HTTP ${resp.status}`);
    }
    return (await resp.json()) as { status: string; service: string };
  }

  /**
   * Calls /api/v1/embeddings to generate 768-dim embedding vector.
   */
  public async embedQuestion(text: string): Promise<number[]> {
    const resp = await fetch(`${this.baseUrl}/api/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      logger.error({ errorText, status: resp.status }, 'FastAPI AI Service embedding call failed');
      throw new Error(`AI Service embedding failed with HTTP ${resp.status}`);
    }

    const data = (await resp.json()) as { embedding: number[] };
    return data.embedding;
  }

  /**
   * Calls /api/v1/rag/query for end-to-end RAG question answering.
   */
  public async queryRag(params: RemoteRagQueryRequest): Promise<RemoteRagQueryResponse> {
    const resp = await fetch(`${this.baseUrl}/api/v1/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      logger.error({ errorText, status: resp.status }, 'FastAPI AI Service RAG query failed');
      throw new Error(`AI Service RAG query failed with HTTP ${resp.status}`);
    }

    return (await resp.json()) as RemoteRagQueryResponse;
  }

  /**
   * Implements the AiClient interface for direct completion.
   */
  public async generateAnswer(
    systemPrompt: string,
    userPrompt: string,
    history: Array<{ role: string; content: string }> = []
  ): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/api/v1/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userPrompt,
        system_prompt: systemPrompt,
        history,
      }),
    });

    if (!resp.ok) {
      throw new Error(`AI Service LLM chat failed with HTTP ${resp.status}`);
    }

    const data = (await resp.json()) as { content: string };
    return data.content;
  }
}

export const fastApiAiServiceClient = new FastApiAiServiceClient();
