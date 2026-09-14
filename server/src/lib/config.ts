import { db } from './db.js';
import { getCompanyById } from './companies.js';

export type Provider = 'openai' | 'anthropic';

export interface AppConfig {
  provider?: Provider;
  apiKey?: string;
  model?: string;
  companyName?: string;
  accentColor?: string;
}

/**
 * Per-company config store, backed by the `companies` table (see lib/db.ts).
 * Holds the LLM provider + API key entered in that company's Setup screen,
 * plus its branding.
 *
 * NOTE: apiKey is plaintext in the DB, which is fine for a local/prototype
 * deployment. Do not reuse this approach as-is for a production multi-tenant
 * deployment — use a secrets manager instead.
 */
export function readConfig(companyId: number): AppConfig | null {
  const company = getCompanyById(companyId);
  if (!company) return null;
  return {
    provider: company.provider,
    apiKey: company.apiKey,
    model: company.model,
    companyName: company.name,
    accentColor: company.accentColor,
  };
}

/**
 * Merge-aware update: applies `patch` on top of the company's current row.
 * Lets the branding form and the provider/key form in Setup each POST
 * independently without clobbering the other.
 */
export function updateConfig(companyId: number, patch: Partial<AppConfig>): AppConfig {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.provider !== undefined) {
    fields.push('provider = ?');
    values.push(patch.provider);
  }
  if (patch.apiKey !== undefined) {
    fields.push('api_key = ?');
    values.push(patch.apiKey);
  }
  if (patch.model !== undefined) {
    fields.push('model = ?');
    values.push(patch.model ?? null);
  }
  if (patch.companyName !== undefined) {
    fields.push('name = ?');
    values.push(patch.companyName);
  }
  if (patch.accentColor !== undefined) {
    fields.push('accent_color = ?');
    values.push(patch.accentColor ?? null);
  }

  if (fields.length > 0) {
    values.push(companyId);
    db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  return readConfig(companyId)!;
}

export function isConfigured(companyId: number): boolean {
  const config = readConfig(companyId);
  return Boolean(config?.apiKey);
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
