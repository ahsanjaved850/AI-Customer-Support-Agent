import type {
  AuthStatus,
  ChatMessage,
  ConfigStatus,
  DocType,
  DocumentMeta,
  Provider,
  SearchResult,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/** Thrown by request() with the HTTP status attached, so callers can tell a
 * 401 (session expired / not logged in) apart from any other failure. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // credentials: 'include' sends the admin session cookie on every request —
  // harmless for public endpoints, required for gated ones (see server's
  // lib/auth.ts). Works both through the Vite dev proxy (same-origin) and
  // when the client is served from a different origin than the API.
  const res = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error ?? `Request failed: ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

/** True if `err` is an ApiError for an expired/missing admin session. */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export function getAuthStatus(): Promise<AuthStatus> {
  return request<AuthStatus>('/api/auth/status');
}

export function login(password: string): Promise<AuthStatus> {
  return request<AuthStatus>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export function logout(): Promise<AuthStatus> {
  return request<AuthStatus>('/api/auth/logout', { method: 'POST' });
}

/**
 * Send the conversation and stream the assistant's reply back. `onChunk`
 * fires with each piece of text as it arrives so the caller can render it
 * incrementally; the full reply is also returned once the stream ends.
 */
export async function sendChatStream(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
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

export function saveBranding(companyName: string, accentColor: string): Promise<ConfigStatus> {
  return request<ConfigStatus>('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName, accentColor }),
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
