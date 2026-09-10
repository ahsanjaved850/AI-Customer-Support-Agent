import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { configRouter } from './routes/config.js';
import { documentsRouter } from './routes/documents.js';
import { searchRouter } from './routes/search.js';
import { isAuthRequired } from './lib/auth.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Only enable when actually behind a reverse proxy (nginx, Caddy, a
// platform load balancer, etc.) — it makes Express trust the proxy's
// X-Forwarded-For header for req.ip, which the rate limiters key on.
// Blindly trusting it with no proxy in front would let a client spoof
// their own IP and dodge rate limiting entirely.
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// credentials: true is required for the admin session cookie to travel on
// cross-origin requests (e.g. the client built as a static SPA and served
// from a different origin than this API) — CORS also refuses to combine
// credentials with a wildcard origin, so CLIENT_ORIGIN must stay a specific
// value in production, never '*'.
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());
// Explicit body-size cap rather than relying on Express's unstated 100kb
// default — file uploads go through multer (its own limit), not this.
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', authRouter);
app.use('/api', configRouter);
app.use('/api', documentsRouter);
app.use('/api', searchRouter);
app.use('/api', chatRouter);

// Anything under /api that didn't match a route above — JSON, not
// Express's default HTML 404 page, to keep API responses consistent.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Catch-all error handler — must be last, and must take all four args for
// Express to recognize it as an error handler rather than normal
// middleware. Without this, an unhandled error (e.g. body-parser's
// "payload too large" before any route's own try/catch even runs) falls
// through to Express's default handler, which returns an HTML page with a
// full stack trace and file paths — a real info leak, and inconsistent
// with every other response here being JSON.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('unhandled error:', err);
  if (res.headersSent) return; // e.g. a chat stream had already started
  const status = (err as { status?: number; statusCode?: number })?.status ?? 500;
  const message = status === 413 ? 'Request body too large' : 'Internal server error';
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  if (!isAuthRequired()) {
    console.warn(
      'WARNING: ADMIN_PASSWORD is not set — the Setup tab (provider/API key, branding, documents) is UNPROTECTED. ' +
        'Set ADMIN_PASSWORD in server/.env before exposing this server beyond localhost.',
    );
  }
});
