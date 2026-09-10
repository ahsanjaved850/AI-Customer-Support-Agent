import { Router } from 'express';
import { readConfig, writeConfig, maskKey, type Provider } from '../lib/config.js';

export const configRouter = Router();

configRouter.get('/config', (_req, res) => {
  const config = readConfig();
  if (!config) {
    return res.json({ configured: false });
  }
  return res.json({
    configured: true,
    provider: config.provider,
    maskedKey: maskKey(config.apiKey),
    model: config.model,
  });
});

configRouter.post('/config', (req, res) => {
  const { provider, apiKey, model } = req.body as {
    provider?: Provider;
    apiKey?: string;
    model?: string;
  };

  if (provider !== 'openai' && provider !== 'anthropic') {
    return res.status(400).json({ error: "provider must be 'openai' or 'anthropic'" });
  }
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    return res.status(400).json({ error: 'apiKey looks too short to be valid' });
  }

  writeConfig({ provider, apiKey: apiKey.trim(), model: model?.trim() || undefined });
  return res.json({ configured: true, provider, maskedKey: maskKey(apiKey) });
});

