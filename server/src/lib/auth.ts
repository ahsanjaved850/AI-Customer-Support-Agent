import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const SESSION_COOKIE_NAME = 'session';

interface SessionRecord {
  companyId: number;
  expiry: number; // epoch ms
}

// In-memory session store: fine for a single-process, self-hosted
// deployment — a server restart just logs everyone out, no persistence
// needed. Do not reuse this approach for a multi-instance deployment
// (sessions wouldn't be shared across processes).
const sessions = new Map<string, SessionRecord>();

export function createSession(companyId: number): string {
  const id = randomUUID();
  sessions.set(id, { companyId, expiry: Date.now() + SESSION_MAX_AGE_MS });
  return id;
}

export function getSession(id: string | undefined): SessionRecord | null {
  if (!id) return null;
  const record = sessions.get(id);
  if (!record) return null;
  if (record.expiry < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return record;
}

export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

/**
 * Gate a route behind the admin session cookie, scoped to the current
 * company (attached to `req.company` by middleware/tenant.ts, which must run
 * first). The companyId check below is the critical line: without it, a
 * valid session cookie for Company A would authorize requests against
 * Company B's data just by changing the URL slug.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req.cookies?.[SESSION_COOKIE_NAME]);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (session.companyId !== req.company.id) {
    res.status(403).json({ error: 'Not authorized for this company' });
    return;
  }
  next();
}
