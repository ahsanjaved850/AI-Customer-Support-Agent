import type { ChatMessage } from '@/types';

const STORAGE_KEY_PREFIX = 'chat-history';
const MAX_STORED_MESSAGES = 50;

// Scoped per company slug so two companies' chat histories in the same
// browser (e.g. visiting /c/acme and /c/globex from the same machine) don't
// collide or leak into each other.
function storageKey(slug: string): string {
  return `${STORAGE_KEY_PREFIX}:${slug}`;
}

/**
 * Persists the chat conversation across page refreshes. Same read/write
 * shape as ColorModeProvider's localStorage handling (try/catch, silent
 * no-op on failure — private browsing, storage disabled, etc.), just with
 * JSON serialization since messages are objects, not a plain string.
 */
export function readStoredMessages(slug: string): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : null;
  } catch {
    return null;
  }
}

export function writeStoredMessages(slug: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // localStorage unavailable (private mode, etc.) — history just won't persist
  }
}

export function clearStoredMessages(slug: string): void {
  try {
    localStorage.removeItem(storageKey(slug));
  } catch {
    // no-op
  }
}
