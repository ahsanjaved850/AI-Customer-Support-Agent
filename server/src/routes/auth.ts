import { Router } from 'express';
import {
  createSession,
  destroySession,
  getSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
} from '../lib/auth.js';
import { verifyAdminLogin } from '../lib/companies.js';
import { loginRateLimiter } from '../lib/rateLimit.js';

export const authRouter = Router();

authRouter.get('/auth/status', (req, res) => {
  const session = getSession(req.cookies?.[SESSION_COOKIE_NAME]);
  const authenticated = Boolean(session && session.companyId === req.company.id);
  res.json({ authRequired: true, authenticated });
});

authRouter.post('/auth/login', loginRateLimiter, (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !verifyAdminLogin(req.company.id, username, password)
  ) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }

  const sessionId = createSession(req.company.id);
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
  res.json({ authRequired: true, authenticated: true });
});

authRouter.post('/auth/logout', (req, res) => {
  destroySession(req.cookies?.[SESSION_COOKIE_NAME]);
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ authRequired: true, authenticated: false });
});
