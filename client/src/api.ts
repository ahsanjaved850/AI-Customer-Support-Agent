import type { ChatMessage, ConfigStatus, DocType, DocumentMeta, Provider, SearchResult } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Send the conversation and stream the assistant's reply back. `onChunk`
 * fires with each piece of text as it arrives so the caller can render it
 * incrementally; the full reply is also returned once the stream ends.
 */
export async function sendChatStream(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }
  if (!res.body) {
    // Fallback for environments without a readable stream (older Safari, etc.)
    const text = await res.text();
    onChunk(text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      full += chunk;
      onChunk(chunk);
    }
  }

  return full;
}

export function getConfig(): Promise<ConfigStatus> {
  return request<ConfigStatus>('/api/config');
}

export function saveConfig(provider: Provider, apiKey: string, model?: string): Promise<ConfigStatus> {
  return request<ConfigStatus>('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey, model }),
  });
}

export function listDocuments(): Promise<{ documents: DocumentMeta[] }> {
  return request('/api/documents');
}

export function uploadDocuments(files: File[], docType: DocType): Promise<{ documents: DocumentMeta[] }> {
  const form = new FormData();
  form.append('docType', docType);
  for (const file of files) form.append('files', file);

  return request('/api/documents', { method: 'POST', body: form });
}

export function deleteDocument(id: string): Promise<{ removed: boolean }> {
  return request(`/api/documents/${id}`, { method: 'DELETE' });
}

export function searchDocuments(query: string): Promise<{ results: SearchResult[] }> {
  return request(`/api/search?q=${encodeURIComponent(query)}`);
}
