import { readConfig } from './config.js';
import type { ChatMessage } from '../types.js';

const DEFAULT_MODELS = {
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-sonnet-5',
};

/**
 * Provider-agnostic streaming chat completion. Reads the stored config (set
 * via the setup screen / POST /api/config) and calls whichever provider the
 * user chose, invoking `onChunk` as text arrives rather than waiting for the
 * full completion — this is what lets the client start rendering a reply
 * immediately instead of after the whole response is generated.
 */
export async function chatCompleteStream(
  systemPrompt: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<void> {
  const config = readConfig();
  if (!config?.apiKey) {
    throw new Error('No LLM provider configured. Set one up via POST /api/config.');
  }

  if (config.provider === 'openai') {
    return streamOpenAI(config.apiKey, config.model ?? DEFAULT_MODELS.openai, systemPrompt, messages, onChunk);
  }
  return streamAnthropic(config.apiKey, config.model ?? DEFAULT_MODELS.anthropic, systemPrompt, messages, onChunk);
}

async function streamOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<void> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content }) as const),
    ],
  });

  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content;
    if (delta) onChunk(delta);
  }
}

async function streamAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<void> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  stream.on('text', (text) => onChunk(text));
  await stream.finalMessage();
}
