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

  // Serve Interactive Web Preview Dashboard for the AI Studio Preview iFrame
  app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProvadorVirtual - API & Web Preview</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --accent: #10b981;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 20px; line-height: 1.5; }
    .container { max-width: 1000px; margin: 0 auto; }
    header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 20px; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
    .logo { display: flex; align-items: center; gap: 12px; }
    .badge { background: rgba(99, 102, 241, 0.2); color: #818cf8; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid rgba(99, 102, 241, 0.4); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 18px; margin-bottom: 12px; color: #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .status-active { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
    .status-inactive { background: var(--danger); }
    .btn { background: var(--primary); color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 14px; width: 100%; margin-top: 10px; }
    .btn:hover { background: var(--primary-hover); }
    .btn-secondary { background: #334155; color: #f8fafc; }
    .btn-secondary:hover { background: #475569; }
    form label { display: block; font-size: 13px; color: var(--text-muted); margin-top: 12px; margin-bottom: 4px; font-weight: 500; }
    select, input { width: 100%; padding: 10px; background: #0f172a; border: 1px solid var(--border); border-radius: 6px; color: white; font-size: 14px; }
    .preview-box { margin-top: 16px; background: #0f172a; border: 1px dashed var(--border); border-radius: 8px; min-height: 200px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
    .preview-box img { max-width: 100%; max-height: 350px; object-fit: contain; }
    .loader { border: 3px solid #334155; border-top: 3px solid var(--primary); border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; display: none; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .code-block { background: #090d16; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #38bdf8; overflow-x: auto; margin-top: 10px; border: 1px solid #1e293b; }
    .notice { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">
        <h1 style="font-size:22px; font-weight:700;">👕 ProvadorVirtual</h1>
        <span class="badge">Expo Native + Express API</span>
      </div>
      <div style="font-size:13px; color: var(--text-muted);">
        Backend URL: <code style="color:#a5b4fc">http://localhost:3000</code>
      </div>
    </header>

    <div class="notice">
      📱 <strong>Aplicativo Expo Nativo (iOS & Android)</strong>: O código mobile principal React Native/Expo está pronto em <code>src/</code> e <code>index.js</code>. Abaixo você pode testar ao vivo o backend e as APIs do Provador Virtual diretamente na janela de preview!
    </div>

    <div class="grid">
      <!-- Card Status do Servidor -->
      <div class="card">
        <h2>
          Status dos Provedores
          <span class="status-dot status-active" id="health-dot"></span>
        </h2>
        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
          Conectado ao servidor de orquestração de IA.
        </div>
        <div id="provider-info" class="code-block">Carregando status...</div>
        <button class="btn btn-secondary" style="margin-top:12px;" onclick="checkHealth()">Atualizar Status</button>
      </div>

      <!-- Card Configuração de IA da Loja -->
      <div class="card">
        <h2>⚙️ Motor de IA da Loja</h2>
        <form id="settings-form" onsubmit="saveSettings(event)">
          <label>Selecione o Provedor de IA:</label>
          <select id="provider_mode">
            <option value="both">Ambos (Perfect Corp + Google Gemini)</option>
            <option value="perfectcorp">Perfect Corp (Especializado em Roupas)</option>
            <option value="google">Google Gemini (Visão Multimodal)</option>
          </select>

          <button type="submit" class="btn">Salvar Configuração</button>
        </form>
        <div id="settings-output" style="margin-top:10px; font-size:12px; color:#34d399;"></div>
      </div>
    </div>

    <!-- Provador Virtual Interactive Tester -->
    <div class="card" style="margin-bottom: 24px;">
      <h2>✨ Testar Provador Virtual (Virtual Try-On)</h2>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
        Selecione as imagens de teste para simular uma geração real do Provador Virtual via backend API.
      </p>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
        <div>
          <label>1. Foto da Pessoa (Person):</label>
          <select id="person_select" onchange="updatePersonPreview()">
            <option value="demo1">Modelo Feminina 1</option>
            <option value="demo2">Modelo Masculino 2</option>
          </select>
          <div class="preview-box" id="person-box">
            <img id="person-img" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80" alt="Pessoa">
          </div>
        </div>

        <div>
          <label>2. Foto da Peça (Garment):</label>
          <select id="garment_select" onchange="updateGarmentPreview()">
            <option value="garment1">Vestido Floral (Full Body)</option>
            <option value="garment2">Camiseta Casual (Upper Body)</option>
            <option value="garment3">Calça Jeans (Lower Body)</option>
          </select>
          <div class="preview-box" id="garment-box">
            <img id="garment-img" src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80" alt="Roupa">
          </div>
        </div>

        <div>
          <label>3. Resultado da IA:</label>
          <div style="margin-bottom: 8px;">
            <button class="btn" id="generate-btn" onclick="runTryOnTest()">Gerar Provador Virtual</button>
          </div>
          <div class="preview-box" id="result-box">
            <div class="loader" id="loader"></div>
            <span id="result-placeholder" style="font-size:12px; color:var(--text-muted); padding:10px; text-align:center;">
              Clique em "Gerar" para processar no backend.
            </span>
            <img id="result-img" style="display:none;" alt="Resultado Provador">
          </div>
        </div>
      </div>

      <div id="result-details" class="code-block" style="display:none; margin-top:16px;"></div>
    </div>
  </div>

  <script>
    const personUrls = {
      demo1: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80',
      demo2: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'
    };

    const garmentUrls = {
      garment1: { url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80', cat: 'full_body' },
      garment2: { url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80', cat: 'upper_body' },
      garment3: { url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&q=80', cat: 'lower_body' }
    };

    function updatePersonPreview() {
      const val = document.getElementById('person_select').value;
      document.getElementById('person-img').src = personUrls[val];
    }

    function updateGarmentPreview() {
      const val = document.getElementById('garment_select').value;
      document.getElementById('garment-img').src = garmentUrls[val].url;
    }

    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        document.getElementById('provider-info').textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        document.getElementById('provider-info').textContent = 'Erro ao conectar com API de Saúde.';
      }
    }

    async function saveSettings(e) {
      e.preventDefault();
      const mode = document.getElementById('provider_mode').value;
      const output = document.getElementById('settings-output');
      output.textContent = 'Salvando...';

      try {
        const res = await fetch('/api/admin/store-ai-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: 'demo-store-001', provider_mode: mode, enabled: true })
        });
        const data = await res.json();
        if (data.success) {
          output.textContent = '✅ Motor de IA atualizado para: ' + mode.toUpperCase();
        } else {
          output.textContent = '❌ Erro: ' + (data.error || 'Falha ao salvar');
        }
      } catch (err) {
        output.textContent = '❌ Erro de conexão com servidor';
      }
    }

    async function runTryOnTest() {
      const pVal = document.getElementById('person_select').value;
      const gVal = document.getElementById('garment_select').value;
      const mode = document.getElementById('provider_mode').value;

      const loader = document.getElementById('loader');
      const placeholder = document.getElementById('result-placeholder');
      const resultImg = document.getElementById('result-img');
      const details = document.getElementById('result-details');
      const btn = document.getElementById('generate-btn');

      loader.style.display = 'block';
      placeholder.style.display = 'none';
      resultImg.style.display = 'none';
      details.style.display = 'none';
      btn.disabled = true;

      try {
        const res = await fetch('/api/admin/test-provider', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: mode === 'google' ? 'google' : 'perfectcorp',
            person_image: personUrls[pVal],
            garment_image: garmentUrls[gVal].url,
            garment_category: garmentUrls[gVal].cat,
            store_id: 'demo-store-001'
          })
        });

        const data = await res.json();
        loader.style.display = 'none';
        btn.disabled = false;

        details.style.display = 'block';
        details.textContent = JSON.stringify(data, null, 2);

        if (data.result_url) {
          resultImg.src = data.result_url;
          resultImg.style.display = 'block';
        } else {
          placeholder.style.display = 'block';
          placeholder.textContent = 'Nenhum resultado de imagem (Verifique o log de erro no JSON).';
        }
      } catch (err) {
        loader.style.display = 'none';
        btn.disabled = false;
        placeholder.style.display = 'block';
        placeholder.textContent = 'Erro ao processar chamada ao backend.';
      }
    }

    checkHealth();
  </script>
</body>
</html>`);
  });

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
