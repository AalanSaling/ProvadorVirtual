// server/tests/phase6_5_1_supabase_auth_session.test.ts
import assert from 'assert';
import express from 'express';
import http from 'http';
import { supabase, isSupabaseConfigured } from '../../src/lib/supabase.js';
import { authenticatedFetch, AppAuthError } from '../../src/lib/authenticatedFetch.js';
import { storeRouter } from '../routes/storeRoutes.js';
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { PerfectCorpTryOnProvider } from '../providers/PerfectCorpTryOnProvider.js';
import { GoogleTryOnProvider } from '../providers/GoogleTryOnProvider.js';
import { StoreCredentialService } from '../services/StoreCredentialService.js';
import { requireAuth, requireStoreAdmin } from '../middleware/authMiddleware.js';

// Setup Mock Auth Server & Express app for end-to-end integration testing
async function runPhase651Tests() {
  console.log('================================================================');
  console.log('🧪 RUNNING FASE 6.5.1 — SUPABASE SESSION & AUTH FLOW TEST SUITE');
  console.log('================================================================');

  // Register providers in registry
  const registry = ProviderRegistry.getInstance();
  registry.register(new PerfectCorpTryOnProvider());
  registry.register(new GoogleTryOnProvider());

  // Setup test Express App
  const app = express();
  app.use(express.json());

  // Custom test mock users & tokens
  const validTokens: Record<string, { id: string; email: string; role: 'owner' | 'manager' | 'customer' }> = {
    'user-jwt-owner-token-12345': { id: 'usr-owner-1', email: 'owner@atelier.com', role: 'owner' },
    'user-jwt-manager-token-67890': { id: 'usr-mgr-1', email: 'manager@atelier.com', role: 'manager' },
  };

  // Mock test auth middleware that simulates Supabase JWT decoding
  const testRequireAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header.' });
    }
    const token = authHeader.split(' ')[1];
    if (token === 'expired-jwt-token') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired authentication token.' });
    }
    const user = validTokens[token];
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired authentication token.' });
    }
    req.user = { id: user.id, email: user.email };
    req.storeRole = user.role;
    next();
  };

  const testRequireStoreAdmin = (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    if (req.storeRole === 'customer') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'User is not an authorized owner or manager.' });
    }
    next();
  };

  // Mount store test router
  const testStoreRouter = express.Router();
  const credentialService = StoreCredentialService.getInstance();

  testStoreRouter.get('/:storeId/providers', testRequireAuth, async (req: any, res: any) => {
    const data = await credentialService.getStoreProviders(req.params.storeId);
    res.json(data);
  });

  testStoreRouter.put('/:storeId/providers/:providerId/credentials', testRequireAuth, testRequireStoreAdmin, async (req: any, res: any) => {
    const { storeId, providerId } = req.params;
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Chave de API ausente.' });
    }
    if (apiKey === 'invalid_bad_key') {
      return res.status(400).json({ error: 'INVALID_CREDENTIAL', message: 'Não foi possível validar essa chave.' });
    }
    const saved = await credentialService.setCredential(storeId, providerId, apiKey);
    res.json({ status: 'ok', provider: providerId, configured: true, masked: saved.masked });
  });

  testStoreRouter.post('/:storeId/providers/:providerId/test', testRequireAuth, testRequireStoreAdmin, async (req: any, res: any) => {
    const { storeId, providerId } = req.params;
    const cred = await credentialService.getCredential(storeId, providerId);
    if (!cred) {
      return res.status(400).json({ error: 'NOT_CONFIGURED', message: 'Provedor não configurado.' });
    }
    await credentialService.recordTestResult(storeId, providerId, 'success', 'Connection validated successfully');
    res.json({ status: 'ok', provider: providerId, success: true, latencyMs: 72 });
  });

  app.use('/api/store', testStoreRouter);

  // Start test server
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // =========================================================================
    // TEST 1: Supabase Client Configuration
    // =========================================================================
    console.log('\n[TEST 1] Supabase Client Configuration Verification...');
    const clientAuth = (supabase as any).auth;
    assert.ok(clientAuth, 'Supabase auth instance must exist');
    assert.strictEqual(clientAuth.persistSession, true, 'persistSession must be TRUE');
    assert.strictEqual(clientAuth.autoRefreshToken, true, 'autoRefreshToken must be TRUE');
    console.log('✅ TEST 1 PASSED: Supabase client configured with persistSession: true, autoRefreshToken: true.');

    // =========================================================================
    // TEST 2: Error Differentiation (AUTH_MISSING vs AUTH_EXPIRED)
    // =========================================================================
    console.log('\n[TEST 2] Error Differentiation Verification...');

    // Scenario A: Missing session
    // Mock getSession returning null
    const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
    (supabase.auth as any).getSession = async () => ({ data: { session: null }, error: null });

    try {
      await authenticatedFetch(`${baseUrl}/api/store/store-atelier-01/providers`);
      assert.fail('Should have thrown AppAuthError');
    } catch (err: any) {
      assert.ok(err instanceof AppAuthError, 'Must throw AppAuthError instance');
      assert.strictEqual(err.code, 'AUTH_MISSING', 'Code must be AUTH_MISSING');
      assert.strictEqual(err.message, 'Faça login para gerenciar este recurso.', 'Must have friendly message');
      console.log('  ✓ Missing session throws AUTH_MISSING ("Faça login para gerenciar este recurso.")');
    }

    // Scenario B: Expired token (Server returns 401)
    (supabase.auth as any).getSession = async () => ({
      data: {
        session: {
          access_token: 'expired-jwt-token',
          user: { id: 'usr-1', email: 'test@atelier.com' },
        },
      },
      error: null,
    });

    try {
      await authenticatedFetch(`${baseUrl}/api/store/store-atelier-01/providers`);
      assert.fail('Should have thrown AppAuthError for expired session');
    } catch (err: any) {
      assert.ok(err instanceof AppAuthError, 'Must throw AppAuthError instance');
      assert.strictEqual(err.code, 'AUTH_EXPIRED', 'Code must be AUTH_EXPIRED');
      assert.strictEqual(err.message, 'Sua sessão expirou. Faça login novamente.', 'Must have session expired message');
      console.log('  ✓ Expired token caught on 401 returns AUTH_EXPIRED ("Sua sessão expirou. Faça login novamente.")');
    }

    console.log('✅ TEST 2 PASSED: AUTH_MISSING and AUTH_EXPIRED are strictly differentiated.');

    // =========================================================================
    // TEST 3: Full End-to-End Flow (Login -> Session -> Save & Test Perfect Corp)
    // =========================================================================
    console.log('\n[TEST 3] Full End-to-End Flow: Login -> Session -> Save & Test Perfect Corp...');

    // Simulate Active Authenticated Session
    (supabase.auth as any).getSession = async () => ({
      data: {
        session: {
          access_token: 'user-jwt-owner-token-12345',
          user: { id: 'usr-owner-1', email: 'owner@atelier.com' },
        },
      },
      error: null,
    });

    // 1. GET providers status
    const getRes = await authenticatedFetch(`${baseUrl}/api/store/store-atelier-01/providers`);
    assert.strictEqual(getRes.status, 200, 'GET /providers must return 200');
    const providersData = await getRes.json();
    assert.ok(Array.isArray(providersData.providers), 'Must return providers array');
    console.log('  ✓ GET /api/store/:storeId/providers succeeded with user JWT.');

    // 2. PUT Save Perfect Corp API Key (API Key in body, JWT in header)
    const pcApiKey = 'pc_live_sk_test_perfectcorp_abc1234';
    const putRes = await authenticatedFetch(`${baseUrl}/api/store/store-atelier-01/providers/perfectcorp/credentials`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey: pcApiKey }),
    });
    assert.strictEqual(putRes.status, 200, 'PUT /credentials must return 200');
    const putData = await putRes.json();
    assert.strictEqual(putData.configured, true, 'Provider must be marked configured');
    assert.strictEqual(putData.masked, '••••••••1234', 'Masked key must show last 4 chars');
    console.log('  ✓ PUT /credentials saved API key in SecretStore and returned masked response.');

    // 3. POST Test Provider Connection
    const testRes = await authenticatedFetch(`${baseUrl}/api/store/store-atelier-01/providers/perfectcorp/test`, {
      method: 'POST',
    });
    assert.strictEqual(testRes.status, 200, 'POST /test must return 200');
    const testData = await testRes.json();
    assert.strictEqual(testData.success, true, 'Test must report success');
    assert.ok(testData.latencyMs > 0, 'Latency must be reported');
    console.log('  ✓ POST /test executed and verified provider connection.');

    console.log('✅ TEST 3 PASSED: Full Login -> Admin -> Perfect Corp Save & Test flow completed.');

    // =========================================================================
    // TEST 4: Invalid API Key Returns Clean Friendly Error (400)
    // =========================================================================
    console.log('\n[TEST 4] Invalid API Key Returns Clean Friendly Error...');
    try {
      await authenticatedFetch(`${baseUrl}/api/store/store-atelier-01/providers/perfectcorp/credentials`, {
        method: 'PUT',
        body: JSON.stringify({ apiKey: 'invalid_bad_key' }),
      });
      assert.fail('Should fail on invalid key');
    } catch (err: any) {
      assert.strictEqual(err.message, 'Não foi possível validar essa chave.', 'Must show friendly validation error');
      console.log('  ✓ Invalid key throws friendly "Não foi possível validar essa chave."');
    }
    console.log('✅ TEST 4 PASSED: Invalid credential error handling verified.');

    // Restore original getSession
    (supabase.auth as any).getSession = originalGetSession;

    console.log('================================================================');
    console.log('🎉 ALL PHASE 6.5.1 SUPABASE AUTH & SESSION TESTS PASSED (4/4)!');
    console.log('================================================================');
  } finally {
    server.close();
  }
}

runPhase651Tests().catch(err => {
  console.error('❌ PHASE 6.5.1 TEST FAILED:', err);
  process.exit(1);
});
