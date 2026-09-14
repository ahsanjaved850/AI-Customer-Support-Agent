import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { readConfig, updateConfig, maskKey, type AppConfig, type Provider } from '../lib/config.js';

export const configRouter = Router();

function toStatus(config: AppConfig | null) {
  if (!config?.apiKey || !config.provider) {
    return { configured: false as const, companyName: config?.companyName, accentColor: config?.accentColor };
  }
  return {
    configured: true as const,
    provider: config.provider,
    maskedKey: maskKey(config.apiKey),
    model: config.model,
    companyName: config.companyName,
    accentColor: config.accentColor,
  };
}

// GET stays public — BrandingProvider needs companyName/accentColor on
// every page load, including the customer-facing chat view, not just Setup.
configRouter.get('/config', (req, res) => {
  res.json(toStatus(readConfig(req.company.id)));
});

configRouter.post('/config', requireAuth, (req, res) => {
  const { provider, apiKey, model, companyName, accentColor } = req.body as {
    provider?: Provider;
    apiKey?: string;
    model?: string;
    companyName?: string;
    accentColor?: string;
  };

  const patch: Partial<AppConfig> = {};

  // Provider/key are only validated and applied if the caller is actually
  // submitting them — this lets the branding form and the provider/key form
  // in Setup each POST independently without clobbering the other.
  const isCredentialUpdate = provider !== undefined || apiKey !== undefined;
  if (isCredentialUpdate) {
    if (provider !== 'openai' && provider !== 'anthropic') {
      return res.status(400).json({ error: "provider must be 'openai' or 'anthropic'" });
    }
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
      return res.status(400).json({ error: 'apiKey looks too short to be valid' });
    }
    patch.provider = provider;
    patch.apiKey = apiKey.trim();
    patch.model = model?.trim() || undefined;
  }

  if (companyName !== undefined) {
    if (typeof companyName !== 'string' || companyName.length > 80) {
      return res.status(400).json({ error: 'companyName must be a string of 80 characters or fewer' });
    }
    // A company's name can't be cleared to nothing (companies.name is NOT
    // NULL) — an empty submission is treated as "leave it unchanged" rather
    // than an error.
    const trimmed = companyName.trim();
    if (trimmed) patch.companyName = trimmed;
  }

  if (accentColor !== undefined) {
    if (accentColor && !/^#[0-9a-f]{6}$/i.test(accentColor)) {
      return res.status(400).json({ error: 'accentColor must be a 6-digit hex code, e.g. #4f46e5' });
    }
    patch.accentColor = accentColor || undefined;
  }

  const updated = updateConfig(req.company.id, patch);
  res.json(toStatus(updated));
});
