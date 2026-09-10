import type { ChatMessage } from '@/types';

const STORAGE_KEY = 'chat-history';
const MAX_STORED_MESSAGES = 50;

/**
 * Persists the chat conversation across page refreshes. Same read/write
 * shape as ColorModeProvider's localStorage handling (try/catch, silent
 * no-op on failure — private browsing, storage disabled, etc.), just with
 * JSON serialization since messages are objects, not a plain string.
 */
export function readStoredMessages(): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : null;
  } catch {
    return null;
  }
}

export function writeStoredMessages(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // localStorage unavailable (private mode, etc.) — history just won't persist
  }
}

export function clearStoredMessages(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
