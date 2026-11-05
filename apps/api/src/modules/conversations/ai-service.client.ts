import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ServiceUnavailableError } from '../../errors/app-error.js';
import type { AiClient } from './ai-client.js';

const EMBED_TIMEOUT_MS = 30_000;
const CHAT_TIMEOUT_MS = 120_000;
const EXPECTED_EMBEDDING_DIMENSION = 768;

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

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.AI_SERVICE_TOKEN) headers['X-Internal-Token'] = env.AI_SERVICE_TOKEN;
    return headers;
  }

  /**
   * POSTs JSON to the AI service with a hard timeout. Any transport failure, timeout or 5xx/429 becomes a
   * clean 503 for the browser (instead of an opaque 500), and the real cause is logged.
   */
  private async post(path: string, body: unknown, timeoutMs: number): Promise<unknown> {
    let resp: Response;
    try {
      resp = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      logger.error({ err, path }, 'AI Service request failed (network or timeout)');
      throw new ServiceUnavailableError(
        'The AI assistant is not reachable right now. Please try again in a moment.'
      );
    }

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '');
      let serverMessage = '';
      try {
        const parsed = JSON.parse(errorText);
        serverMessage = parsed.message || parsed.error || '';
      } catch {
        // Not JSON
      }
      logger.error({ errorText: errorText.slice(0, 500), status: resp.status, path }, 'AI Service call failed');
      if (resp.status === 429) {
        throw new ServiceUnavailableError(
          serverMessage || 'The AI assistant rate limit was exceeded. Please wait a moment before trying again.'
        );
      }
      if (resp.status >= 500) {
        throw new ServiceUnavailableError(
          serverMessage || 'The AI assistant is temporarily unavailable. Please try again shortly.'
        );
      }
      throw new Error(serverMessage || `AI Service call to ${path} failed with HTTP ${resp.status}`);
    }

    return resp.json();
  }

  /**
   * Health check to verify AI Service readiness.
   */
  public async checkHealth(): Promise<{ status: string; service: string }> {
    const resp = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) {
      throw new Error(`AI Service health check failed with HTTP ${resp.status}`);
    }
    return (await resp.json()) as { status: string; service: string };
  }

  /**
   * Calls /api/v1/embeddings to generate 768-dim embedding vector.
   */
  public async embedQuestion(text: string): Promise<number[]> {
    const data = (await this.post('/api/v1/embeddings', { text }, EMBED_TIMEOUT_MS)) as {
      embedding?: number[];
    };
    if (!Array.isArray(data?.embedding) || data.embedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
      logger.error(
        { received: Array.isArray(data?.embedding) ? data.embedding.length : typeof data?.embedding },
        'AI Service returned an invalid embedding'
      );
      throw new ServiceUnavailableError('The AI assistant returned an unexpected response. Please try again.');
    }
    return data.embedding;
  }

  /**
   * Calls /api/v1/rag/query for end-to-end RAG question answering.
   */
  public async queryRag(params: RemoteRagQueryRequest): Promise<RemoteRagQueryResponse> {
    return (await this.post('/api/v1/rag/query', params, CHAT_TIMEOUT_MS)) as RemoteRagQueryResponse;
  }

  /**
   * Implements the AiClient interface for direct completion.
   */
  public async generateAnswer(
    systemPrompt: string,
    userPrompt: string,
    history: Array<{ role: string; content: string }> = []
  ): Promise<string> {
    const data = (await this.post(
      '/api/v1/llm/chat',
      { prompt: userPrompt, system_prompt: systemPrompt, history },
      CHAT_TIMEOUT_MS
    )) as { content?: string };
    return typeof data?.content === 'string' ? data.content : '';
  }

  /**
   * Streams answer tokens from /api/v1/llm/chat/stream (Server-Sent Events). Failures are mapped to the
   * same errors as `post()`: unreachable/timeout/5xx/429 -> ServiceUnavailableError, other 4xx -> Error.
   */
  public async *streamAnswer(
    systemPrompt: string,
    userPrompt: string,
    history: Array<{ role: string; content: string }> = []
  ): AsyncIterable<string> {
    const path = '/api/v1/llm/chat/stream';
    let resp: Response;
    try {
      resp = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ prompt: userPrompt, system_prompt: systemPrompt, history }),
        signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
      });
    } catch (err) {
      logger.error({ err, path }, 'AI Service request failed (network or timeout)');
      throw new ServiceUnavailableError(
        'The AI assistant is not reachable right now. Please try again in a moment.'
      );
    }

    if (!resp.ok || !resp.body) {
      const errorText = await resp.text().catch(() => '');
      let serverMessage = '';
      try {
        const parsed = JSON.parse(errorText);
        serverMessage = parsed.message || parsed.error || '';
      } catch {
        // Not JSON
      }
      logger.error({ errorText: errorText.slice(0, 500), status: resp.status, path }, 'AI Service call failed');
      if (resp.status === 429 || resp.status >= 500) {
        throw new ServiceUnavailableError(
          serverMessage || 'The AI assistant is temporarily unavailable. Please try again shortly.'
        );
      }
      throw new Error(serverMessage || `AI Service call to ${path} failed with HTTP ${resp.status}`);
    }

    const decoder = new TextDecoder();
    const reader = resp.body.getReader();
    let buffer = '';
    try {
      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (err) {
          logger.error({ err, path }, 'AI Service stream interrupted (network or timeout)');
          throw new ServiceUnavailableError(
            'The AI assistant stopped responding. Please try again in a moment.'
          );
        }
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          let eventName = 'message';
          let data = '';
          for (const line of rawEvent.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          const payload = data ? (JSON.parse(data) as Record<string, unknown>) : {};

          if (eventName === 'token' && typeof payload.token === 'string') {
            yield payload.token;
          } else if (eventName === 'done') {
            return;
          } else if (eventName === 'error') {
            const message = typeof payload.message === 'string' ? payload.message : '';
            const status = typeof payload.status_code === 'number' ? payload.status_code : 500;
            logger.error({ status, message, path }, 'AI Service stream reported an error');
            if (status === 429 || status >= 500) {
              throw new ServiceUnavailableError(
                message || 'The AI assistant is temporarily unavailable. Please try again shortly.'
              );
            }
            throw new Error(message || `AI Service stream failed with HTTP ${status}`);
          }
        }
      }
    } finally {
      reader.cancel().catch(() => undefined);
    }

    // Stream closed without a `done` event: treat as an interrupted answer, never as a complete one.
    throw new ServiceUnavailableError('The AI assistant stopped responding. Please try again in a moment.');
  }
}

export const fastApiAiServiceClient = new FastApiAiServiceClient();
