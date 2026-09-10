import { chatCompleteStream } from './llm.js';
import { embedQuery } from './embeddings.js';
import { search } from './vectorStore.js';
import type { ChatMessage } from '../types.js';

const BASE_SYSTEM_PROMPT = `You are a friendly, concise customer support agent.
Answer the user's question directly. If you don't know something, say so and
offer to escalate to a human.`;

// How many chunks to retrieve per question. Not currently score-filtered —
// the model is instructed to judge relevance itself and ignore context that
// doesn't apply, which is simpler and more robust than picking a fixed
// similarity-score cutoff that would need re-tuning per embedding model.
const TOP_K = 4;

/**
 * Stream an assistant reply for the given conversation using whichever LLM
 * provider the user configured (see lib/config.ts + lib/llm.ts). `onChunk`
 * fires as text arrives from the provider.
 *
 * Retrieves relevant chunks from the ingested policy/ticket documents
 * (lib/vectorStore.ts) for the latest user message and folds them into the
 * system prompt so answers are grounded in company data when it's relevant.
 */
export async function streamReply(messages: ChatMessage[], onChunk: (text: string) => void): Promise<void> {
  const systemPrompt = await buildSystemPrompt(messages);
  return chatCompleteStream(systemPrompt, messages, onChunk);
}

export async function buildSystemPrompt(messages: ChatMessage[]): Promise<string> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return BASE_SYSTEM_PROMPT;

  try {
    const queryVector = await embedQuery(lastUser.content);
    const results = search(queryVector, TOP_K);
    if (results.length === 0) return BASE_SYSTEM_PROMPT;

    const context = results
      .map((r, i) => `[${i + 1}] (${r.docType} — ${r.filename})\n${r.text}`)
      .join('\n\n');

    return `${BASE_SYSTEM_PROMPT}

Use the following context from the company's policies and past support tickets to answer, when it's actually relevant to the question. Answer naturally (e.g. "per our refund policy..."); don't mention "[1]"-style labels to the user. If none of the context is relevant to the question, ignore it entirely and answer normally — never force an unrelated policy into your answer.

Context:
${context}`;
  } catch (err) {
    // Retrieval is best-effort: if embedding/search fails (e.g. the local
    // embedding model hasn't finished loading, or something else goes
    // wrong), fall back to an ungrounded reply rather than failing the
    // whole chat request.
    console.error('retrieval error (falling back to ungrounded reply):', err);
    return BASE_SYSTEM_PROMPT;
  }
}
