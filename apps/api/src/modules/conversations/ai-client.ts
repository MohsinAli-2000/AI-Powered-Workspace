import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface AiClient {
  embedQuestion(text: string): Promise<number[]>;
  generateAnswer(
    systemPrompt: string,
    userPrompt: string,
    history?: Array<{ role: string; content: string }>
  ): Promise<string>;
}

/**
 * ============================================================================
 * LOCAL OLLAMA CLIENT IMPLEMENTATION (Commented out for reference)
 * ============================================================================
 * This code demonstrates how to interact with local AI models via Ollama's REST API.
 * 
 * OVERVIEW - How to run AI models locally with Ollama:
 * 1. Install Ollama: https://ollama.com
 * 2. Download models:
 *      ollama pull nomic-embed-text   # (768-dim embeddings)
 *      ollama pull qwen2.5:1.5b       # (Fast, low-resource LLM)
 * 3. Start daemon: ollama serve (runs on http://localhost:11434)
 * 4. Configure .env:
 *      AI_PROVIDER=ollama
 *      OLLAMA_BASE_URL=http://localhost:11434
 * 5. To re-enable: Uncomment the OllamaAiClient class below and its call in getAiClient().
 */
/*
export class OllamaAiClient implements AiClient {
  private readonly baseUrl: string;
  private readonly embeddingModel: string;
  private readonly llmModel: string;

  constructor() {
    this.baseUrl = env.OLLAMA_BASE_URL.replace(/\/$/, '');
    this.embeddingModel = env.EMBEDDING_MODEL;
    this.llmModel = env.LLM_MODEL;
  }

  public async embedQuestion(text: string): Promise<number[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      // 1. Attempt modern batch /api/embed endpoint
      const embedResp = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text.trim(),
        }),
        signal: controller.signal,
      });

      if (embedResp.ok) {
        const data = (await embedResp.json()) as { embeddings?: number[][] };
        if (data.embeddings && data.embeddings.length > 0) {
          return data.embeddings[0];
        }
      }

      // 2. Fallback to legacy /api/embeddings endpoint
      const fallbackResp = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: text.trim(),
        }),
        signal: controller.signal,
      });

      if (!fallbackResp.ok) {
        throw new Error(
          `Ollama embedding failed with HTTP ${fallbackResp.status}: ${await fallbackResp.text()}`
        );
      }

      const fallbackData = (await fallbackResp.json()) as { embedding?: number[] };
      if (!fallbackData.embedding) {
        throw new Error('Ollama returned empty embedding array');
      }

      return fallbackData.embedding;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async generateAnswer(
    systemPrompt: string,
    userPrompt: string,
    history: Array<{ role: string; content: string }> = []
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((h) => ({
          role: h.role.toLowerCase() === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        })),
        { role: 'user', content: userPrompt },
      ];

      const resp = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.llmModel,
          messages,
          stream: false,
          options: {
            temperature: 0.1, // low temperature for factual grounding
            num_predict: 512, // limit token generation for fast local CPU inference
          },
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`Ollama chat failed with HTTP ${resp.status}: ${await resp.text()}`);
      }

      const data = (await resp.json()) as { message?: { content?: string } };
      return data.message?.content?.trim() || 'No answer generated.';
    } finally {
      clearTimeout(timeout);
    }
  }
}
*/

/**
 * Deterministic Mock AI Client for testing and offline environments.
 */
export class MockAiClient implements AiClient {
  public async embedQuestion(text: string): Promise<number[]> {
    const dimension = 768;
    const hash = crypto.createHash('sha256').update(text.trim()).digest();

    const vector: number[] = [];
    for (let i = 0; i < dimension; i++) {
      const byteIdx = (i * 4) % hash.length;
      const val = hash.readInt16BE(byteIdx);
      vector.push(Math.sin(val + i));
    }

    // L2 Normalize
    const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
    if (norm === 0) return vector;
    return vector.map((x) => x / norm);
  }

  public async generateAnswer(
    systemPrompt: string,
    userPrompt: string,
    _history: Array<{ role: string; content: string }> = []
  ): Promise<string> {
    // Extract context excerpts if present in prompt
    if (systemPrompt.includes('Context Excerpts:')) {
      const excerptsIndex = systemPrompt.indexOf('Context Excerpts:');
      const excerptsText = systemPrompt.substring(excerptsIndex);
      return `Based on the provided documents: ${excerptsText.slice(0, 200)}... This answers your question: "${userPrompt.slice(0, 100)}"`;
    }
    return `Answer to: ${userPrompt}`;
  }
}

import { fastApiAiServiceClient } from './ai-service.client.js';

let aiClientInstance: AiClient | null = null;

export const getAiClient = (providerOverride?: 'ollama' | 'mock' | 'ai-service'): AiClient => {
  if (providerOverride === 'mock') {
    return new MockAiClient();
  }
  // Local Ollama override (commented out for reference):
  // if (providerOverride === 'ollama') {
  //   return new OllamaAiClient();
  // }
  if (providerOverride === 'ai-service' || providerOverride === 'ollama') {
    return fastApiAiServiceClient;
  }

  if (!aiClientInstance) {
    if (env.AI_PROVIDER === 'mock') {
      logger.info('Using MockAiClient for RAG operations');
      aiClientInstance = new MockAiClient();
    } else if (env.AI_PROVIDER === 'ai-service') {
      logger.info(
        { baseUrl: env.AI_SERVICE_URL },
        'Using FastApiAiServiceClient for RAG operations'
      );
      aiClientInstance = fastApiAiServiceClient;
    } else {
      /*
      // Local Ollama branch (commented out for reference - uncomment if using Ollama):
      logger.info(
        { baseUrl: env.OLLAMA_BASE_URL, model: env.LLM_MODEL },
        'Using OllamaAiClient for RAG operations'
      );
      aiClientInstance = new OllamaAiClient();
      */
      logger.info(
        { baseUrl: env.AI_SERVICE_URL },
        'Defaulting to FastApiAiServiceClient for RAG operations (Ollama client is commented out)'
      );
      aiClientInstance = fastApiAiServiceClient;
    }
  }
  return aiClientInstance;
};
