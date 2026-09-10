import { Router } from 'express';
import {
  createSession,
  destroySession,
  isAuthRequired,
  isValidSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  verifyPassword,
} from '../lib/auth.js';
import { loginRateLimiter } from '../lib/rateLimit.js';

export const authRouter = Router();

authRouter.get('/auth/status', (req, res) => {
  if (!isAuthRequired()) {
    return res.json({ authRequired: false, authenticated: true });
  }
  const authenticated = isValidSession(req.cookies?.[SESSION_COOKIE_NAME]);
  res.json({ authRequired: true, authenticated });
});

authRouter.post('/auth/login', loginRateLimiter, (req, res) => {
  if (!isAuthRequired()) {
    return res.json({ authRequired: false, authenticated: true });
  }

  const { password } = req.body as { password?: string };
  if (typeof password !== 'string' || !verifyPassword(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const sessionId = createSession();
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
  res.json({ authRequired: isAuthRequired(), authenticated: false });
});
