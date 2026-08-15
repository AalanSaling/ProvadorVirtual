// server/routes/storeRoutes.ts
import { Router, Response } from 'express';
import { requireAuth, requireStoreAdmin, supabaseAdmin } from '../middleware/authMiddleware.js';
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const storeRouter = Router();

// GET store AI provider configuration
storeRouter.get('/:storeId/ai-config', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('store_provider_configs')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) {
      logger.error('Error reading store AI config', error);
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: error.message });
      return;
    }

    const registry = ProviderRegistry.getInstance();
    const availableProviders = registry.listProvidersInfo();

    res.json({
      storeId,
      enabledProviders: data?.enabled_providers || [],
      defaultProvider: data?.default_provider || null,
      availableSystemProviders: availableProviders,
    });
  } catch (err) {
    logger.error('Error in GET /api/store/:storeId/ai-config', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to read AI config.' });
  }
});

// POST store AI provider configuration (Admin action)
storeRouter.post('/:storeId/ai-config', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { enabledProviders, defaultProvider } = req.body;

    if (!Array.isArray(enabledProviders)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'enabledProviders must be an array of provider IDs.' });
      return;
    }

    // Validate that enabled providers exist in system ProviderRegistry
    const registry = ProviderRegistry.getInstance();
    for (const pId of enabledProviders) {
      if (!registry.has(pId)) {
        res.status(400).json({ error: 'BAD_REQUEST', message: `Provider '${pId}' is not registered in the system.` });
        return;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('store_provider_configs')
      .upsert(
        {
          store_id: storeId,
          enabled_providers: enabledProviders,
          default_provider: defaultProvider || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'store_id' }
      )
      .select()
      .single();

    if (error) {
      logger.error('Error saving store AI config', error);
      res.status(500).json({ error: 'DATABASE_ERROR', message: error.message });
      return;
    }

    res.json({
      storeId,
      enabledProviders: data.enabled_providers,
      defaultProvider: data.default_provider,
      updatedAt: data.updated_at,
    });
  } catch (err) {
    logger.error('Error in POST /api/store/:storeId/ai-config', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to update AI config.' });
  }
});
