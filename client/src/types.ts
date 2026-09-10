export type Role = 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export type Provider = 'openai' | 'anthropic';

export type ConfigStatus =
  | { configured: false }
  | { configured: true; provider: Provider; maskedKey: string; model?: string };

export type DocType = 'policy' | 'ticket';

export interface DocumentMeta {
  id: string;
  filename: string;
  docType: DocType;
  uploadedAt: string;
  chunkCount: number;
}

export interface SearchResult {
  text: string;
  score: number;
  docId: string;
  filename: string;
  docType: DocType;
}
