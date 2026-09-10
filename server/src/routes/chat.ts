import { Router } from 'express';
import { streamReply } from '../lib/agent.js';
import { chatRateLimiter } from '../lib/rateLimit.js';
import type { ChatMessage, ChatRequestBody } from '../types.js';

export const chatRouter = Router();

function isValidMessage(m: unknown): m is ChatMessage {
  return (
    typeof m === 'object' &&
    m !== null &&
    (('role' in m && (m.role === 'user' || m.role === 'assistant')) as boolean) &&
    'content' in m &&
    typeof (m as ChatMessage).content === 'string'
  );
}

chatRouter.post('/chat', chatRateLimiter, async (req, res) => {
  const body = req.body as Partial<ChatRequestBody>;

  if (!Array.isArray(body.messages) || !body.messages.every(isValidMessage)) {
    return res.status(400).json({ error: 'Expected { messages: ChatMessage[] }' });
  }

  // Streamed as plain text (chunked transfer), not JSON — the client reads
  // the response body incrementally so replies start rendering as soon as
  // the provider produces the first token, instead of after the full
  // completion. Headers are only actually sent on the first res.write(),
  // so an error before any text arrives (e.g. no provider configured) can
  // still fall through to the JSON error response below.
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    await streamReply(body.messages, (chunk) => {
      res.write(chunk);
    });
    res.end();
  } catch (err) {
    console.error('chat error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate a reply' });
    } else {
      // Streaming had already started; best effort is to just close the
      // connection so the client's reader terminates instead of hanging.
      res.end();
    }
  }
});
