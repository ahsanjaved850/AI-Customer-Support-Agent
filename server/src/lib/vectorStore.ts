import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export type DocType = 'policy' | 'ticket';

export interface DocumentMeta {
  id: string;
  filename: string;
  docType: DocType;
  uploadedAt: string;
  chunkCount: number;
}

interface Chunk {
  id: string;
  docId: string;
  filename: string;
  docType: DocType;
  text: string;
  embedding: number[];
}

export interface SearchResult {
  text: string;
  score: number;
  docId: string;
  filename: string;
  docType: DocType;
}

// Resolve relative to this file (server/src/lib -> server/data), not
// process.cwd(), so it lands in the same place regardless of where `node`
// was launched from.
const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const DOCS_PATH = path.join(DATA_DIR, 'documents.json');
const VECTORS_PATH = path.join(DATA_DIR, 'vectors.json');

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadDocuments(): DocumentMeta[] {
  return readJson<DocumentMeta[]>(DOCS_PATH, []);
}

function loadChunks(): Chunk[] {
  return readJson<Chunk[]>(VECTORS_PATH, []);
}

export function listDocuments(): DocumentMeta[] {
  return loadDocuments();
}

/**
 * Store a newly-ingested document: its registry entry plus one row per
 * embedded chunk. This is a flat JSON file acting as a tiny vector store —
 * fine at hundreds/low-thousands of chunks. Swap for SQLite+sqlite-vec or a
 * hosted vector DB if this ever needs to scale further.
 */
export function addDocument(
  filename: string,
  docType: DocType,
  chunkTexts: string[],
  embeddings: number[][],
): DocumentMeta {
  const docId = randomUUID();
  const documents = loadDocuments();
  const chunks = loadChunks();

  const meta: DocumentMeta = {
    id: docId,
    filename,
    docType,
    uploadedAt: new Date().toISOString(),
    chunkCount: chunkTexts.length,
  };

  documents.push(meta);
  for (let i = 0; i < chunkTexts.length; i++) {
    chunks.push({
      id: randomUUID(),
      docId,
      filename,
      docType,
      text: chunkTexts[i],
      embedding: embeddings[i],
    });
  }

  writeJson(DOCS_PATH, documents);
  writeJson(VECTORS_PATH, chunks);
  return meta;
}

export function deleteDocument(docId: string): boolean {
  const documents = loadDocuments();
  const remaining = documents.filter((d) => d.id !== docId);
  if (remaining.length === documents.length) return false;

  const chunks = loadChunks().filter((c) => c.docId !== docId);
  writeJson(DOCS_PATH, remaining);
  writeJson(VECTORS_PATH, chunks);
  return true;
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

export function search(queryVector: number[], topK = 4): SearchResult[] {
  const chunks = loadChunks();

  return chunks
    .map((c) => ({
      text: c.text,
      score: cosineSimilarity(queryVector, c.embedding),
      docId: c.docId,
      filename: c.filename,
      docType: c.docType,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
