import { Router } from 'express';
import multer from 'multer';
import { extractText } from '../lib/extractText.js';
import { chunkText } from '../lib/chunk.js';
import { embedTexts } from '../lib/embeddings.js';
import { listDocuments, addDocument, deleteDocument, type DocType } from '../lib/vectorStore.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
export const documentsRouter = Router();

documentsRouter.get('/documents', (_req, res) => {
  res.json({ documents: listDocuments() });
});

documentsRouter.post('/documents', upload.array('files'), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  const docType = (req.body.docType as DocType) ?? 'policy';

  if (docType !== 'policy' && docType !== 'ticket') {
    return res.status(400).json({ error: "docType must be 'policy' or 'ticket'" });
  }
  if (!files?.length) {
    return res.status(400).json({ error: 'No files uploaded (field name: files)' });
  }

  try {
    const results = [];
    for (const file of files) {
      const text = await extractText(file.originalname, file.buffer);
      const chunks = chunkText(text);
      if (chunks.length === 0) continue;

      const embeddings = await embedTexts(chunks);
      results.push(addDocument(file.originalname, docType, chunks, embeddings));
    }
    return res.json({ documents: results });
  } catch (err) {
    console.error('ingest error:', err);
    const message = err instanceof Error ? err.message : 'Failed to ingest documents';
    return res.status(500).json({ error: message });
  }
});

documentsRouter.delete('/documents/:id', (req, res) => {
  const removed = deleteDocument(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Document not found' });
  return res.json({ removed: true });
});

