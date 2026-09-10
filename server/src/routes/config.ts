import { Router } from 'express';
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

configRouter.get('/config', (_req, res) => {
  res.json(toStatus(readConfig()));
});

configRouter.post('/config', (req, res) => {
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
    patch.companyName = companyName.trim() || undefined;
  }

  if (accentColor !== undefined) {
    if (accentColor && !/^#[0-9a-f]{6}$/i.test(accentColor)) {
      return res.status(400).json({ error: 'accentColor must be a 6-digit hex code, e.g. #4f46e5' });
    }
    patch.accentColor = accentColor || undefined;
  }

  const updated = updateConfig(patch);
  res.json(toStatus(updated));
});
