import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { embedQuery } from '../lib/embeddings.js';
import { search } from '../lib/vectorStore.js';

export const searchRouter = Router();

/**
 * Manual retrieval-testing endpoint: embed a query and return the closest
 * chunks, without involving the LLM. Used only by the Setup tab's "Test
 * retrieval" section, not by the customer-facing chat widget — gated
 * accordingly, since it would otherwise let anyone read raw chunk text out
 * of the company's ingested documents by guessing queries.
 */
searchRouter.get('/search', requireAuth, async (req, res) => {
  const q = req.query.q;
  if (typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: 'Query param "q" is required' });
  }

  try {
    const vector = await embedQuery(req.company.id, q);
    const results = search(req.company.id, vector, 5);
    return res.json({ results });
  } catch (err) {
    console.error('search error:', err);
    const message = err instanceof Error ? err.message : 'Search failed';
    return res.status(500).json({ error: message });
  }
});
