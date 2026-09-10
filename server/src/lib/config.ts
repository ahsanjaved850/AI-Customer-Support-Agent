import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Provider = 'openai' | 'anthropic';

export interface AppConfig {
  provider: Provider;
  apiKey: string;
  model?: string;
}

// Resolve relative to this file (server/src/lib -> server/data), not
// process.cwd(), so it lands in the same place regardless of where `node`
// was launched from.
const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

/**
 * Local, single-tenant config store. Holds the LLM provider + API key the
 * user entered in the setup screen.
 *
 * NOTE: this is plaintext on disk, which is fine for a local/learning
 * project run by a single person. Do not reuse this approach as-is for a
 * multi-user or production deployment — use a secrets manager instead.
 */
function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readConfig(): AppConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as AppConfig;
  } catch {
    return null;
  }
}

export function writeConfig(config: AppConfig): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function isConfigured(): boolean {
  const config = readConfig();
  return Boolean(config?.apiKey);
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
