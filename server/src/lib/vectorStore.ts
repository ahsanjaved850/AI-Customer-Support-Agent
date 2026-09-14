import { randomUUID } from 'node:crypto';
import { db } from './db.js';

export type DocType = 'policy' | 'ticket';

export interface DocumentMeta {
  id: string;
  filename: string;
  docType: DocType;
  uploadedAt: string;
  chunkCount: number;
}

export interface SearchResult {
  text: string;
  score: number;
  docId: string;
  filename: string;
  docType: DocType;
}

interface DocumentRow {
  id: string;
  filename: string;
  doc_type: DocType;
  uploaded_at: string;
  chunk_count: number;
}

interface ChunkRow {
  id: string;
  document_id: string;
  filename: string;
  doc_type: DocType;
  text: string;
  embedding: string;
}

function rowToMeta(row: DocumentRow): DocumentMeta {
  return {
    id: row.id,
    filename: row.filename,
    docType: row.doc_type,
    uploadedAt: row.uploaded_at,
    chunkCount: row.chunk_count,
  };
}

export function listDocuments(companyId: number): DocumentMeta[] {
  const rows = db
    .prepare('SELECT * FROM documents WHERE company_id = ? ORDER BY uploaded_at DESC')
    .all(companyId) as DocumentRow[];
  return rows.map(rowToMeta);
}

/**
 * Store a newly-ingested document: its registry row plus one row per
 * embedded chunk, scoped to `companyId` — SQLite standing in for a tiny
 * per-tenant vector store (fine at hundreds/low-thousands of chunks per
 * company; swap for a hosted vector DB if this ever needs to scale further).
 */
export function addDocument(
  companyId: number,
  filename: string,
  docType: DocType,
  chunkTexts: string[],
  embeddings: number[][],
): DocumentMeta {
  const docId = randomUUID();
  const uploadedAt = new Date().toISOString();

  const insertDoc = db.prepare(
    'INSERT INTO documents (id, company_id, filename, doc_type, uploaded_at, chunk_count) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insertChunk = db.prepare(
    'INSERT INTO chunks (id, document_id, company_id, filename, doc_type, text, embedding) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );

  const insertAll = db.transaction(() => {
    insertDoc.run(docId, companyId, filename, docType, uploadedAt, chunkTexts.length);
    for (let i = 0; i < chunkTexts.length; i++) {
      insertChunk.run(randomUUID(), docId, companyId, filename, docType, chunkTexts[i], JSON.stringify(embeddings[i]));
    }
  });
  insertAll();

  return { id: docId, filename, docType, uploadedAt, chunkCount: chunkTexts.length };
}

// Scoped to companyId, not just id — without this a company could delete
// another company's document by guessing its UUID. Chunks cascade-delete via
// the chunks.document_id foreign key (see lib/db.ts's `foreign_keys = ON`).
export function deleteDocument(companyId: number, docId: string): boolean {
  const info = db.prepare('DELETE FROM documents WHERE id = ? AND company_id = ?').run(docId, companyId);
  return info.changes > 0;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function search(companyId: number, queryVector: number[], topK = 4): SearchResult[] {
  const rows = db.prepare('SELECT * FROM chunks WHERE company_id = ?').all(companyId) as ChunkRow[];

  return rows
    .map((c) => ({
      text: c.text,
      score: cosineSimilarity(queryVector, JSON.parse(c.embedding) as number[]),
      docId: c.document_id,
      filename: c.filename,
      docType: c.doc_type,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
