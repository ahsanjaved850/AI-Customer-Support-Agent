import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';
import type { Provider } from './config.js';

export interface Company {
  id: number;
  slug: string;
  name: string;
  accentColor?: string;
  provider?: Provider;
  apiKey?: string;
  model?: string;
}

interface CompanyRow {
  id: number;
  slug: string;
  name: string;
  accent_color: string | null;
  provider: string | null;
  api_key: string | null;
  model: string | null;
}

function rowToCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    accentColor: row.accent_color ?? undefined,
    provider: (row.provider as Provider | null) ?? undefined,
    apiKey: row.api_key ?? undefined,
    model: row.model ?? undefined,
  };
}

export function getCompanyBySlug(slug: string): Company | null {
  const row = db.prepare('SELECT * FROM companies WHERE slug = ?').get(slug) as CompanyRow | undefined;
  return row ? rowToCompany(row) : null;
}

export function getCompanyById(id: number): Company | null {
  const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as CompanyRow | undefined;
  return row ? rowToCompany(row) : null;
}

export function createCompany(params: { slug: string; name: string }): Company {
  const info = db.prepare('INSERT INTO companies (slug, name) VALUES (?, ?)').run(params.slug, params.name);
  return getCompanyById(Number(info.lastInsertRowid))!;
}

// scrypt (Node's built-in KDF) rather than bcrypt — no native addon beyond
// better-sqlite3, consistent with this codebase's existing preference for
// node:crypto primitives (see the old timingSafeEqual password check this
// replaces). Stored as "saltHex:hashHex".
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function createAdminUser(companyId: number, username: string, password: string): void {
  db.prepare('INSERT INTO admin_users (company_id, username, password_hash) VALUES (?, ?, ?)').run(
    companyId,
    username,
    hashPassword(password),
  );
}

/**
 * Verify a login attempt for a specific company. Usernames are unique only
 * within a company (see the admin_users UNIQUE(company_id, username)
 * constraint), so companyId must always be supplied by the caller — never
 * trust a bare username to identify who's logging in.
 */
export function verifyAdminLogin(companyId: number, username: string, password: string): boolean {
  const row = db
    .prepare('SELECT password_hash FROM admin_users WHERE company_id = ? AND username = ?')
    .get(companyId, username) as { password_hash: string } | undefined;
  if (!row) return false;
  return verifyPasswordHash(password, row.password_hash);
}
