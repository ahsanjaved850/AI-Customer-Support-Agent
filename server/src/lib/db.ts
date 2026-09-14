import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// Resolve relative to this file (server/src/lib -> server/data), not
// process.cwd(), so it lands in the same place regardless of where `node`
// was launched from — same pattern the flat-JSON stores used before.
const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Idempotent schema setup, called once at server startup. No migration
 * framework — at prototype scale, hand-written `IF NOT EXISTS` DDL run on
 * every boot is sufficient.
 */
export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      accent_color TEXT,
      provider TEXT,
      api_key TEXT,
      model TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(company_id, username)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      chunk_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_company ON chunks(company_id);
  `);
}
