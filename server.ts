import express, { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { TryOnService } from './server/services/TryOnService';
import { runVtonTestSuite } from './server/services/testRunner';
import { GarmentCategoryType, StoreProviderMode } from './server/providers/types';
import { ensureStorageBucketsExist } from './server/services/storageHelper';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
  storeRole?: string;
}

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
};

/**
 * Authentication Middleware: Validates Supabase JWT from Authorization Bearer header
 */
async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return res.status(401).json({
      error: 'Autenticação necessária: Token JWT do Supabase não fornecido no cabeçalho Authorization.',
    });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do Supabase indisponível no servidor.' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Sessão inválida ou token JWT expirado.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    return next();
  } catch (err: any) {
    return res.status(401).json({ error: `Erro na validação do token JWT: ${err.message}` });
  }
}

/**
 * Admin Verification Middleware: Checks if user has 'owner' or 'manager' role for store_id
 */
async function requireStoreAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  const storeId = req.params.store_id || req.body.store_id || req.query.store_id;

  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  if (!storeId) {
    return res.status(400).json({ error: 'Parâmetro store_id obrigatório para verificação de permissão.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase admin indisponível.' });
  }

  try {
    const { data, error } = await supabase
      .from('store_members')
      .select('role')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (error || !data) {
      // For demo store fallback when store_members is empty
      if (storeId === 'demo-store-001') {
        req.storeRole = 'owner';
        return next();
      }
      return res.status(403).json({
        error: 'Acesso negado: Você não possui vínculo com esta loja.',
      });
    }

    if (data.role !== 'owner' && data.role !== 'manager') {
      return res.status(403).json({
        error: `Acesso negado: Função (${data.role}) insuficiente. Requer permissão de Administrador (Owner ou Manager).`,
      });
    }

    req.storeRole = data.role;
    return next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Rate Limiting Middleware (Persistent in database)
 */
async function rateLimitMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.user?.id || 'anon';
  const supabase = getSupabaseAdmin();

  if (!supabase) return next();

  try {
    const rateKey = `user:${userId}:try_on`;
    const { data: allowed, error } = await supabase.rpc('check_rate_limit', {
      p_key: rateKey,
      p_max_limit: 10, // Max 10 requests per minute
      p_window_seconds: 60,
    });

    if (error) {
      // Fallback query to try_on_generations table
      const oneMinAgo = new Date(Date.now() - 60000).toISOString();
      const { count } = await supabase
        .from('try_on_generations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneMinAgo);

      if (count && count >= 10) {
        return res.status(429).json({
          error: 'Limite de requisições do provador virtual excedido (10 por minuto). Aguarde um momento.',
        });
      }
      return next();
    }

    if (allowed === false) {
      return res.status(429).json({
        error: 'Limite de requisições excedido. Por favor, aguarde antes de gerar novos provadores.',
      });
    }

    return next();
  } catch {
    return next();
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Controlled CORS Middleware (Requirement 21)
  const allowedOrigins = process.env.ALLOWED_ORIGIN || '*';
  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    res.setHeader(
      'Access-Control-Allow-Origin',
      allowedOrigins === '*' ? '*' : allowedOrigins.includes(origin) ? origin : allowedOrigins
    );
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-api-key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  // Ensure private storage buckets exist on server start
  const supabaseAdmin = getSupabaseAdmin();
  if (supabaseAdmin) {
    await ensureStorageBucketsExist();
  }

  const tryOnService = new TryOnService();

  // Public Health & Provider Status Check Route
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      app: 'Provador Virtual Real Multi-Loja (Expo Native + Express API)',
      providers: {
        perfectcorp_configured: !!(process.env.PERFECTCORP_API_KEY || process.env.PERFECT_CORP_API_KEY),
        perfectcorp_host: process.env.PERFECTCORP_API_HOST || 'https://s2s.perfectcorp.com',
        google_configured: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
        google_model: process.env.GOOGLE_IMAGE_MODEL || 'gemini-3.1-flash-image',
      },
    });
  });

  // Protected Provider Status Endpoint
  app.get('/api/provider/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    return res.json({
      authenticated: true,
      user_id: req.user?.id,
      perfectcorp: !!(process.env.PERFECTCORP_API_KEY || process.env.PERFECT_CORP_API_KEY),
      google: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
    });
  });

  // 1. Virtual Try-On Execution API (Requires Auth + Rate Limit)
  app.post(
    '/api/try-on/generate',
    requireAuth,
    rateLimitMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const {
          person_image,
          garment_image,
          garment_category,
          store_id,
          product_id,
          requested_provider,
        } = req.body;

        const userId = req.user!.id; // Never trust user_id sent in request body!

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
            userId,
            productId: product_id || undefined,
          },
          requested_provider as StoreProviderMode
        );

        return res.json(result);
      } catch (err: any) {
        console.error('Error in /api/try-on/generate:', err);
        return res.status(500).json({
          error: err.message || 'Não foi possível processar o provador virtual.',
        });
      }
    }
  );

  // 2. Admin API: Get Store AI Engine Settings (Requires Auth + Admin Role)
  app.get(
    '/api/admin/store-ai-settings/:store_id',
    requireAuth,
    requireStoreAdmin,
    async (req: AuthenticatedRequest, res) => {
      const { store_id } = req.params;
      const mode = (await tryOnService.getStoreProviderMode(store_id)) || 'both';
      return res.json({ store_id, provider_mode: mode, enabled: true });
    }
  );

  // 3. Admin API: Save Store AI Engine Settings (Requires Auth + Admin Role)
  app.post(
    '/api/admin/store-ai-settings',
    requireAuth,
    requireStoreAdmin,
    async (req: AuthenticatedRequest, res) => {
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
          message: 'Configuração do motor de IA atualizada com sucesso.',
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // 4. Admin API: Diagnostic Test for a specific Provider (Requires Auth + Admin Role)
  app.post(
    '/api/admin/test-provider',
    requireAuth,
    requireStoreAdmin,
    async (req: AuthenticatedRequest, res) => {
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
    }
  );

  // 5. Admin API: Run VTON Test Suite (Requires Auth)
  app.get('/api/admin/run-tests', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const suiteResults = await runVtonTestSuite();
      return res.json(suiteResults);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 6. Products API Endpoints (Requires Auth)
  app.get('/api/products', requireAuth, async (req: AuthenticatedRequest, res) => {
    const storeId = (req.query.store_id as string) || 'demo-store-001';
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Supabase indisponível.' });

    const { data, error } = await supabase
      .from('products')
      .select('*, product_photos(storage_path, type)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ products: data });
  });

  app.post('/api/products', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res) => {
    const { store_id, name, description, category, price, sizes, stock, active, catalogImageBase64, tryOnImageBase64 } = req.body;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Supabase indisponível.' });

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .insert({
        store_id,
        name,
        description,
        category,
        price,
        sizes: sizes || ['P', 'M', 'G'],
        stock: stock ?? 10,
        active: active ?? true,
      })
      .select()
      .single();

    if (prodErr || !product) return res.status(500).json({ error: prodErr?.message || 'Erro ao criar produto.' });

    return res.json({ success: true, product });
  });

  app.put('/api/products/:id', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { name, description, category, price, sizes, stock, active } = req.body;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Supabase indisponível.' });

    const { data: product, error } = await supabase
      .from('products')
      .update({
        name,
        description,
        category,
        price,
        sizes,
        stock,
        active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, product });
  });

  app.delete('/api/products/:id', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Supabase indisponível.' });

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, message: 'Produto excluído com sucesso.' });
  });

  // 7. Store API: Get user's stores (Requires Auth)
  app.get('/api/store/my-store', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'Supabase indisponível.' });

    const { data, error } = await supabase
      .from('store_members')
      .select('role, store_id, stores(id, name, slug)')
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ stores: data || [] });
  });

  // Start Express API Server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend API server running on http://localhost:${PORT}`);
  });
}

startServer();
