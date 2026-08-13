import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { TryOnService } from './server/services/TryOnService';
import { runVtonTestSuite } from './server/services/testRunner';
import { GarmentCategoryType, StoreProviderMode } from './server/providers/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  const tryOnService = new TryOnService();

  const getSupabaseAdmin = () => {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (!url || !key) return null;
    return createClient(url, key);
  };

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      app: 'Provador Virtual Real Multi-Loja (Perfect Corp + Google Gemini)',
      providers: {
        perfectcorp_configured: !!(process.env.PERFECTCORP_API_KEY || process.env.PERFECT_CORP_API_KEY),
        google_configured: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
        google_model: process.env.GOOGLE_IMAGE_MODEL || 'gemini-3.1-flash-image',
      },
    });
  });

  // Main Virtual Try-On Execution API Route
  app.post('/api/try-on/generate', async (req, res) => {
    try {
      const {
        person_image,
        garment_image,
        garment_category,
        store_id,
        user_id,
        product_id,
        requested_provider,
      } = req.body;

      if (!person_image) {
        return res.status(400).json({ error: 'Foto da pessoa (person_image) não fornecida.' });
      }

      if (!garment_image) {
        return res.status(400).json({ error: 'Foto da roupa de referência (garment_image) não fornecida.' });
      }

      const category: GarmentCategoryType =
        garment_category === 'full_body' ||
        garment_category === 'upper_body' ||
        garment_category === 'lower_body' ||
        garment_category === 'shoes'
          ? garment_category
          : 'auto';

      const result = await tryOnService.executeTryOn(
        {
          personImage: person_image,
          garmentImage: garment_image,
          garmentCategory: category,
          storeId: store_id || 'demo-store-001',
          userId: user_id || undefined,
          productId: product_id || undefined,
        },
        requested_provider as StoreProviderMode
      );

      return res.json(result);
    } catch (err: any) {
      console.error('Error in /api/try-on/generate:', err);
      return res.status(500).json({
        error: 'Não foi possível processar o provador virtual. Ocorreu uma falha no servidor de IA.',
        details: err.message,
      });
    }
  });

  // Admin API: Get Store AI Engine Settings
  app.get('/api/admin/store-ai-settings/:store_id', async (req, res) => {
    const { store_id } = req.params;
    const mode = await tryOnService.getStoreProviderMode(store_id);
    return res.json({ store_id, provider_mode: mode, enabled: true });
  });

  // Admin API: Save Store AI Engine Settings
  app.post('/api/admin/store-ai-settings', async (req, res) => {
    try {
      const { store_id, provider_mode, enabled } = req.body;
      if (!store_id || !provider_mode) {
        return res.status(400).json({ error: 'store_id e provider_mode são obrigatórios.' });
      }

      if (
        provider_mode !== 'perfectcorp' &&
        provider_mode !== 'google' &&
        provider_mode !== 'both'
      ) {
        return res.status(400).json({ error: 'provider_mode inválido. Opções: perfectcorp, google, both.' });
      }

      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase
          .from('store_ai_settings')
          .upsert({
            store_id,
            provider_mode,
            enabled: enabled !== undefined ? enabled : true,
            updated_at: new Date().toISOString(),
          });
      }

      return res.json({
        success: true,
        store_id,
        provider_mode,
        message: 'Configuração do motor de IA atualizada com sucesso no banco de dados da loja.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Admin API: Diagnostic Test for a specific Provider
  app.post('/api/admin/test-provider', async (req, res) => {
    try {
      const { provider, person_image, garment_image, garment_category } = req.body;
      if (provider !== 'perfectcorp' && provider !== 'google') {
        return res.status(400).json({ error: 'Provedor para diagnóstico deve ser "perfectcorp" ou "google".' });
      }

      const dummyImage =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

      const personImg = person_image || dummyImage;
      const garmentImg = garment_image || dummyImage;

      const providerResult = await tryOnService.testProvider(provider, {
        personImage: personImg,
        garmentImage: garmentImg,
        garmentCategory: garment_category || 'upper_body',
      });

      return res.json({
        provider: providerResult.provider,
        request_accepted: true,
        processing: false,
        completed: providerResult.status === 'success',
        status: providerResult.status,
        latency_ms: providerResult.latencyMs,
        error_code: providerResult.errorCode,
        error_message: providerResult.errorMessage,
        result_url: providerResult.image,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Admin API: Run VTON Test Suite (15 Test Cases)
  app.get('/api/admin/run-tests', async (req, res) => {
    try {
      const suiteResults = await runVtonTestSuite();
      return res.json(suiteResults);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development preview
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
