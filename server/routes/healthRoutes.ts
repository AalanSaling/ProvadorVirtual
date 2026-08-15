// server/routes/healthRoutes.ts
import { Router } from 'express';
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/health', (req, res) => {
  const registry = ProviderRegistry.getInstance();
  const availableProviders = registry.listProvidersInfo();

  res.json({
    status: 'ok',
    system: 'Provador Virtual Greenfield API',
    environment: env.NODE_ENV,
    modelConfiguration: {
      googleImageModel: env.GOOGLE_IMAGE_MODEL,
      perfectCorpHost: env.PERFECTCORP_API_HOST,
      resultsTtlDays: env.TRY_ON_RESULTS_TTL_DAYS,
    },
    registeredProviders: availableProviders,
    timestamp: new Date().toISOString(),
  });
});
