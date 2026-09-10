export type Role = 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export type Provider = 'openai' | 'anthropic';

export type ConfigStatus =
  | { configured: false; companyName?: string; accentColor?: string }
  | {
      configured: true;
      provider: Provider;
      maskedKey: string;
      model?: string;
      companyName?: string;
      accentColor?: string;
    };

export interface AuthStatus {
  authRequired: boolean;
  authenticated: boolean;
}

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
