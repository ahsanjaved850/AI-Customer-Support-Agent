import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const SESSION_COOKIE_NAME = 'session';

// In-memory session store: fine for a single-process, single-admin,
// self-hosted deployment — a server restart just logs everyone out, no
// persistence needed. Do not reuse this approach for a multi-instance
// deployment (sessions wouldn't be shared across processes).
const sessions = new Map<string, number>(); // sessionId -> expiry (epoch ms)

/**
 * Whether this deployment has an admin password configured. If not, admin
 * endpoints stay open — convenient for local dev, but set ADMIN_PASSWORD in
 * server/.env before exposing this server beyond localhost.
 */
export function isAuthRequired(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;

  const provided = Buffer.from(password);
  const actual = Buffer.from(expected);
  // timingSafeEqual requires equal-length buffers; a length mismatch is
  // already a "no match" so it's safe to short-circuit before comparing.
  if (provided.length !== actual.length) return false;
  return timingSafeEqual(provided, actual);
}

export function createSession(): string {
  const id = randomUUID();
  sessions.set(id, Date.now() + SESSION_MAX_AGE_MS);
  return id;
}

export function isValidSession(id: string | undefined): boolean {
  if (!id) return false;
  const expiry = sessions.get(id);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    sessions.delete(id);
    return false;
  }
  return true;
}

export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

/**
 * Gate a route behind the admin session cookie. A no-op (always calls
 * next()) when no ADMIN_PASSWORD is configured — see isAuthRequired().
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthRequired()) {
    next();
    return;
  }
  if (isValidSession(req.cookies?.[SESSION_COOKIE_NAME])) {
    next();
    return;
  }
  res.status(401).json({ error: 'Authentication required' });
}
