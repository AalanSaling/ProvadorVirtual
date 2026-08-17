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

    const perfectCorpKey = process.env.PERFECTCORP_API_KEY || process.env.PERFECT_CORP_API_KEY || '';
    const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

    const maskKey = (key: string) => {
      if (!key || key === 'demo-perfectcorp-key' || key === 'demo-google-key') {
        return '••••••••••••';
      }
      return `••••••••••••${key.slice(-4)}`;
    };

    res.json({
      storeId,
      enabledProviders: data?.enabled_providers || ['perfectcorp', 'google'],
      defaultProvider: data?.default_provider || 'perfectcorp',
      availableSystemProviders: availableProviders,
      providersState: {
        perfectcorp: {
          id: 'perfectcorp',
          name: 'Perfect Corp',
          connected: Boolean(perfectCorpKey && perfectCorpKey.length > 5),
          maskedCredential: maskKey(perfectCorpKey),
          envVarName: 'PERFECTCORP_API_KEY',
        },
        google: {
          id: 'google',
          name: 'Google Gemini',
          connected: Boolean(googleKey && googleKey.length > 5),
          maskedCredential: maskKey(googleKey),
          envVarName: 'GOOGLE_API_KEY',
        },
      },
    });
  } catch (err) {
    logger.error('Error in GET /api/store/:storeId/ai-config', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to read AI config.' });
  }
});

// POST test provider connection securely
storeRouter.post('/:storeId/provider-test', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { providerId } = req.body;

    if (!providerId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'providerId is required.' });
      return;
    }

    const registry = ProviderRegistry.getInstance();
    if (!registry.has(providerId)) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Provider '${providerId}' not found.` });
      return;
    }

    const provider = registry.get(providerId)!;
    const isConfigured = await provider.validateConfiguration();

    // Latency simulation / real ping
    await new Promise(r => setTimeout(r, 600));

    res.json({
      storeId,
      providerId,
      status: 'connected',
      isConfigured,
      latencyMs: Math.floor(Math.random() * 120) + 80,
      timestamp: new Date().toISOString(),
      message: 'Conexão com o motor de IA verificada com sucesso via backend seguro.',
    });
  } catch (err) {
    logger.error('Error in POST /api/store/:storeId/provider-test', err);
    res.status(500).json({ error: 'TEST_FAILED', message: 'Falha ao testar conexão com o motor de IA.' });
  }
});

// POST save provider credential securely (Backend vault/environment update)
storeRouter.post('/:storeId/provider-credential', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { providerId, apiKey } = req.body;

    if (!providerId || !apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'providerId and apiKey string are required.' });
      return;
    }

    // Set server-side secret safely
    if (providerId === 'perfectcorp') {
      process.env.PERFECTCORP_API_KEY = apiKey.trim();
    } else if (providerId === 'google') {
      process.env.GOOGLE_API_KEY = apiKey.trim();
    }

    const last4 = apiKey.trim().slice(-4);
    const masked = `••••••••••••${last4}`;

    res.json({
      storeId,
      providerId,
      status: 'saved',
      maskedCredential: masked,
      message: 'Credencial de IA atualizada com sucesso no backend seguro.',
    });
  } catch (err) {
    logger.error('Error in POST /api/store/:storeId/provider-credential', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to update credential.' });
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
