import rateLimit from 'express-rate-limit';

// POST /api/chat is a direct, unauthenticated pass-through to a paid LLM
// API (it's the customer-facing surface, so it can't be gated behind admin
// auth) — this is the main defense against runaway cost/abuse. Override the
// default via CHAT_RATE_LIMIT_MAX if it's too strict/loose for real traffic.
export const chatRateLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.CHAT_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages — please wait a moment and try again.' },
});

// Slows down password-guessing against POST /api/c/:slug/auth/login — every
// company's admin login shares this limiter, keyed on IP (see lib/auth.ts).
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please wait before trying again.' },
});
