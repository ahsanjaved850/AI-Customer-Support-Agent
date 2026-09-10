import { Router } from 'express';
import { embedQuery } from '../lib/embeddings.js';
import { search } from '../lib/vectorStore.js';

export const searchRouter = Router();

/**
 * Manual retrieval-testing endpoint: embed a query and return the closest
 * chunks, without involving the LLM. Useful for checking ingestion +
 * embeddings work before wiring retrieval into /api/chat (that wiring is
 * Phase 3).
 */
searchRouter.get('/search', async (req, res) => {
  const q = req.query.q;
  if (typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: 'Query param "q" is required' });
  }

  try {
    const vector = await embedQuery(q);
    const results = search(vector, 5);
    return res.json({ results });
  } catch (err) {
    console.error('search error:', err);
    const message = err instanceof Error ? err.message : 'Search failed';
    return res.status(500).json({ error: message });
  }
});

