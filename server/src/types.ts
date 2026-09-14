import type { Company } from './lib/companies.js';

export type Role = 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
}

// Attached by middleware/tenant.ts before any route handler runs, so every
// gated/scoped route can read req.company.id without re-deriving it.
declare global {
  namespace Express {
    interface Request {
      company: Company;
    }
  }
}
