import { chatCompleteStream } from './llm.js';
import type { ChatMessage } from '../types.js';

const SYSTEM_PROMPT = `You are a friendly, concise customer support agent.
Answer the user's question directly. If you don't know something, say so and
offer to escalate to a human.`;

/**
 * Stream an assistant reply for the given conversation using whichever LLM
 * provider the user configured (see lib/config.ts + lib/llm.ts). `onChunk`
 * fires as text arrives from the provider.
 *
 * This does not yet ground answers in company policy/ticket data — that's
 * added in Phase 3 by retrieving relevant chunks (lib/vectorStore.ts) and
 * folding them into the system prompt before this call.
 */
export async function streamReply(messages: ChatMessage[], onChunk: (text: string) => void): Promise<void> {
  return chatCompleteStream(SYSTEM_PROMPT, messages, onChunk);
}
