// server/tests/phase6_5_provider_auth.test.ts
import assert from 'assert';
import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import { StoreCredentialService } from '../services/StoreCredentialService.js';
import { EncryptedFileSecretStore } from '../services/SecretStore.js';
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { ITryOnProvider } from '../providers/interfaces/ITryOnProvider.js';
import { ExecutionContext, ProviderCapabilities, TryOnInput, TryOnResult } from '../types/index.js';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🧪 RUNNING FASE 6.5 — PROVIDER AUTH & CONFIGURATION VALIDATION TESTS');
console.log('================================================================');

// Mock Providers with configurable validation behavior
class MockConfigurableProvider implements ITryOnProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities = { upperBody: true, lowerBody: true, fullBody: true, shoes: true };
  public lastValidatedContext?: Partial<ExecutionContext>;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  async validateConfiguration(context?: Partial<ExecutionContext>): Promise<boolean> {
    this.lastValidatedContext = context;
    const key = context?.storeApiKey;
    if (!key || typeof key !== 'string') return false;
    // Keys containing 'invalid' or starting with 'bad_' or empty fail validation
    if (key.includes('invalid') || key.startsWith('bad_') || key.trim().length === 0) {
      return false;
    }
    return true;
  }

  async generateTryOn(input: TryOnInput, context?: ExecutionContext): Promise<TryOnResult> {
    return {
      provider: this.id,
      status: 'success',
      resultImage: 'https://cdn.atelier.test/result.png',
      providerTaskId: `task_${this.id}_123`,
      durationMs: 150,
      errorCode: undefined,
      errorMessage: undefined,
    };
  }
}

// Simulated Store Members Table for Auth Tests
const mockStoreMembers: Record<string, Record<string, 'owner' | 'manager' | 'customer'>> = {
  'store-alpha': {
    'user-owner-1': 'owner',
    'user-manager-2': 'manager',
    'user-customer-3': 'customer',
  },
  'store-beta': {
    'user-owner-beta': 'owner',
  },
};

// Simulated Token -> User Mapping
const tokenUserMap: Record<string, { id: string; email: string }> = {
  'jwt-token-owner': { id: 'user-owner-1', email: 'owner@atelier.test' },
  'jwt-token-manager': { id: 'user-manager-2', email: 'manager@atelier.test' },
  'jwt-token-customer': { id: 'user-customer-3', email: 'customer@atelier.test' },
  'jwt-token-beta': { id: 'user-owner-beta', email: 'owner.beta@atelier.test' },
};

// Express test harness with authMiddleware & storeRoutes logic
function createTestApp(credentialService: StoreCredentialService, registry: ProviderRegistry) {
  const app = express();
  app.use(express.json());

  // Require Auth Middleware
  const requireAuth = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header.' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const user = tokenUserMap[token];
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired authentication token.' });
      return;
    }
    req.user = user;
    next();
  };

  // Require Store Admin Middleware
  const requireStoreAdmin = (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      return;
    }
    const storeId = req.params.storeId || req.body?.storeId;
    const userRole = mockStoreMembers[storeId]?.[req.user.id];
    if (!userRole || (userRole !== 'owner' && userRole !== 'manager')) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'User is not an authorized owner or manager for this store.' });
      return;
    }
    req.storeRole = userRole;
    next();
  };

  // GET providers
  app.get('/api/store/:storeId/providers', requireAuth, async (req, res) => {
    const { storeId } = req.params;
    const data = await credentialService.getStoreProviders(storeId);
    res.json(data);
  });

  // PUT credential (Save and Test)
  app.put('/api/store/:storeId/providers/:providerId/credentials', requireAuth, requireStoreAdmin, async (req: any, res: any) => {
    const { storeId, providerId } = req.params;
    const { apiKey } = req.body;

    if (!providerId || !apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'providerId and a valid secret string are required.' });
    }

    if (!registry.has(providerId)) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Provider '${providerId}' is not registered.` });
    }

    // 1. Save encrypted into store SecretStore
    const { masked } = await credentialService.setCredential(storeId, providerId, apiKey.trim());

    // 2. Retrieve the stored secret
    const storeApiKey = await credentialService.getCredential(storeId, providerId);
    if (!storeApiKey) {
      return res.status(400).json({
        status: 'error',
        error: 'CREDENTIAL_MISSING',
        message: 'Não foi possível validar essa chave.',
      });
    }

    // 3. Test real provider configuration using storeApiKey
    const provider = registry.get(providerId)!;
    const isValid = await provider.validateConfiguration({
      storeId,
      providerId,
      storeApiKey,
    });

    if (!isValid) {
      await credentialService.recordTestResult(storeId, providerId, 'failed', 'Não foi possível validar essa chave.');
      return res.status(400).json({
        status: 'error',
        error: 'INVALID_CREDENTIAL',
        message: 'Não foi possível validar essa chave.',
      });
    }

    // 4. Record success only after actual provider validation passes
    await credentialService.recordTestResult(storeId, providerId, 'success', 'Conexão validada com sucesso');

    res.json({
      provider: providerId,
      providerId,
      storeId,
      configured: true,
      masked,
      status: 'success',
      lastTest: {
        status: 'success',
        testedAt: new Date().toISOString(),
      },
      message: 'Credencial salva e validada com sucesso no backend seguro.',
    });
  });

  // POST test provider
  app.post('/api/store/:storeId/providers/:providerId/test', requireAuth, requireStoreAdmin, async (req: any, res: any) => {
    const { storeId, providerId } = req.params;

    if (!registry.has(providerId)) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Provider '${providerId}' not found.` });
    }

    const storeApiKey = await credentialService.getCredential(storeId, providerId);
    if (!storeApiKey) {
      return res.status(400).json({
        error: 'CREDENTIAL_MISSING',
        status: 'error',
        message: 'Nenhuma credencial configurada para este motor de IA. Conecte sua chave primeiro.',
      });
    }

    const provider = registry.get(providerId)!;
    const isConfigured = await provider.validateConfiguration({
      storeId,
      providerId,
      storeApiKey,
    });

    if (!isConfigured) {
      await credentialService.recordTestResult(storeId, providerId, 'failed', 'Não foi possível validar essa chave.');
      return res.status(400).json({
        status: 'error',
        error: 'INVALID_CREDENTIAL',
        message: 'Não foi possível validar essa chave.',
      });
    }

    await credentialService.recordTestResult(storeId, providerId, 'success', 'Conexão OK');

    res.json({
      storeId,
      provider: providerId,
      status: 'success',
      isConfigured: true,
      latencyMs: 75,
      message: 'Conexão com o motor de IA testada e confirmada com sucesso via backend seguro.',
    });
  });

  // DELETE credential
  app.delete('/api/store/:storeId/providers/:providerId/credentials', requireAuth, requireStoreAdmin, async (req: any, res: any) => {
    const { storeId, providerId } = req.params;
    await credentialService.deleteCredential(storeId, providerId);
    res.json({
      provider: providerId,
      storeId,
      configured: false,
      masked: null,
      message: 'Credencial removida com sucesso do backend seguro.',
    });
  });

  return app;
}

// Helper to make test HTTP requests
async function makeRequest(
  serverUrl: string,
  path: string,
  method = 'GET',
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; data: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      res => {
        let resBody = '';
        res.on('data', chunk => (resBody += chunk));
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = JSON.parse(resBody);
          } catch {
            parsed = resBody;
          }
          resolve({ status: res.statusCode || 500, data: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  const testVaultDir = path.resolve(process.cwd(), 'data', 'test_vaults');
  if (!fs.existsSync(testVaultDir)) {
    fs.mkdirSync(testVaultDir, { recursive: true });
  }
  const testVaultFile = path.join(testVaultDir, `test_auth_vault_${Date.now()}.enc`);
  const secretStore = new EncryptedFileSecretStore(testVaultFile, 'test-master-key-seed-phase6-5');
  const credentialService = new StoreCredentialService(secretStore);

  const registry = ProviderRegistry.getInstance();
  registry.reset();

  const pcProvider = new MockConfigurableProvider('perfectcorp', 'Perfect Corp AI');
  const googleProvider = new MockConfigurableProvider('google', 'Google Gemini AI');
  registry.register(pcProvider);
  registry.register(googleProvider);

  const app = createTestApp(credentialService, registry);
  const server = http.createServer(app);

  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`📡 Test Server running on ${baseUrl}`);

  try {
    // =========================================================================
    // TEST A: Sem JWT → 401 Unauthorized
    // =========================================================================
    console.log('\n[TEST A] Request sem JWT no Authorization header → 401...');
    const resNoAuth = await makeRequest(
      baseUrl,
      '/api/store/store-alpha/providers/perfectcorp/credentials',
      'PUT',
      {},
      { apiKey: 'sk_test_12345' }
    );
    assert.strictEqual(resNoAuth.status, 401, 'Should return 401 without Authorization header');
    assert.strictEqual(resNoAuth.data.error, 'UNAUTHORIZED');
    console.log('✅ TEST A PASSED: Sem JWT retorna 401 Unauthorized.');

    // =========================================================================
    // TEST B: JWT Válido + Owner → Funciona (200)
    // =========================================================================
    console.log('\n[TEST B] JWT Válido + Role Owner → 200 OK & Salva Secret...');
    const resOwner = await makeRequest(
      baseUrl,
      '/api/store/store-alpha/providers/perfectcorp/credentials',
      'PUT',
      { Authorization: 'Bearer jwt-token-owner' },
      { apiKey: 'pc_live_key_alpha_owner_9988' }
    );
    assert.strictEqual(resOwner.status, 200, 'Owner should succeed in saving credentials');
    assert.strictEqual(resOwner.data.status, 'success');
    assert.strictEqual(resOwner.data.configured, true);
    assert.strictEqual(resOwner.data.masked, '••••••••9988');
    assert.strictEqual(pcProvider.lastValidatedContext?.storeApiKey, 'pc_live_key_alpha_owner_9988');
    console.log('✅ TEST B PASSED: JWT Válido com Owner salva credencial e executa validação.');

    // =========================================================================
    // TEST C: JWT Válido + Manager → Funciona (200)
    // =========================================================================
    console.log('\n[TEST C] JWT Válido + Role Manager → 200 OK & Salva Secret...');
    const resManager = await makeRequest(
      baseUrl,
      '/api/store/store-alpha/providers/perfectcorp/credentials',
      'PUT',
      { Authorization: 'Bearer jwt-token-manager' },
      { apiKey: 'pc_live_key_alpha_manager_7766' }
    );
    assert.strictEqual(resManager.status, 200, 'Manager should succeed in saving credentials');
    assert.strictEqual(resManager.data.status, 'success');
    assert.strictEqual(resManager.data.masked, '••••••••7766');
    console.log('✅ TEST C PASSED: JWT Válido com Manager salva credencial e executa validação.');

    // =========================================================================
    // TEST D: JWT Válido + Customer → 403 Forbidden
    // =========================================================================
    console.log('\n[TEST D] JWT Válido + Role Customer → 403 Forbidden...');
    const resCustomer = await makeRequest(
      baseUrl,
      '/api/store/store-alpha/providers/perfectcorp/credentials',
      'PUT',
      { Authorization: 'Bearer jwt-token-customer' },
      { apiKey: 'pc_malicious_key_1122' }
    );
    assert.strictEqual(resCustomer.status, 403, 'Customer role must be blocked with 403');
    assert.strictEqual(resCustomer.data.error, 'FORBIDDEN');
    console.log('✅ TEST D PASSED: Customer é estritamente bloqueado com 403 Forbidden.');

    // =========================================================================
    // TEST E: API Key Correta → Provider Test Retorna Sucesso
    // =========================================================================
    console.log('\n[TEST E] API Key Correta → Provider validateConfiguration() sucesso...');
    const resTestSuccess = await makeRequest(
      baseUrl,
      '/api/store/store-alpha/providers/perfectcorp/test',
      'POST',
      { Authorization: 'Bearer jwt-token-owner' }
    );
    assert.strictEqual(resTestSuccess.status, 200);
    assert.strictEqual(resTestSuccess.data.status, 'success');
    assert.strictEqual(resTestSuccess.data.isConfigured, true);
    console.log('✅ TEST E PASSED: Teste com credencial válida confirma conexão com IA.');

    // =========================================================================
    // TEST F: API Key Incorreta → Provider Test Falha (400) e não grava sucesso
    // =========================================================================
    console.log('\n[TEST F] API Key Incorreta → Falha na validação do provider (400)...');
    const resBadKey = await makeRequest(
      baseUrl,
      '/api/store/store-alpha/providers/perfectcorp/credentials',
      'PUT',
      { Authorization: 'Bearer jwt-token-owner' },
      { apiKey: 'bad_invalid_key_0000' }
    );
    assert.strictEqual(resBadKey.status, 400, 'Invalid key must return 400');
    assert.strictEqual(resBadKey.data.error, 'INVALID_CREDENTIAL');
    assert.strictEqual(resBadKey.data.message, 'Não foi possível validar essa chave.');
    console.log('✅ TEST F PASSED: Chave inválida não registra sucesso e retorna erro amigável.');

    // =========================================================================
    // TEST G: Desconectar → Remove Secret do SecretStore
    // =========================================================================
    console.log('\n[TEST G] Desconectar Provedor (DELETE) → Remove secret do SecretStore...');
    const resDelete = await makeRequest(
      baseUrl,
      '/api/store/store-alpha/providers/perfectcorp/credentials',
      'DELETE',
      { Authorization: 'Bearer jwt-token-owner' }
    );
    assert.strictEqual(resDelete.status, 200);
    assert.strictEqual(resDelete.data.configured, false);
    assert.strictEqual(resDelete.data.masked, null);

    const secretAfterDelete = await credentialService.getCredential('store-alpha', 'perfectcorp');
    assert.strictEqual(secretAfterDelete, null, 'Secret must be completely removed from SecretStore');
    console.log('✅ TEST G PASSED: Desconectar remove com sucesso o segredo do vault.');

    // =========================================================================
    // TEST H: Google Provider Mesma Lógica
    // =========================================================================
    console.log('\n[TEST H] Google Gemini Provider: Salvar, Testar e Validar Contexto...');
    const resGoogleSave = await makeRequest(
      baseUrl,
      '/api/store/store-alpha/providers/google/credentials',
      'PUT',
      { Authorization: 'Bearer jwt-token-owner' },
      { apiKey: 'google_ai_live_sk_alpha_4321' }
    );
    assert.strictEqual(resGoogleSave.status, 200);
    assert.strictEqual(resGoogleSave.data.masked, '••••••••4321');
    assert.strictEqual(googleProvider.lastValidatedContext?.storeApiKey, 'google_ai_live_sk_alpha_4321');

    const resGoogleTest = await makeRequest(
      baseUrl,
      '/api/store/store-alpha/providers/google/test',
      'POST',
      { Authorization: 'Bearer jwt-token-owner' }
    );
    assert.strictEqual(resGoogleTest.status, 200);
    assert.strictEqual(resGoogleTest.data.status, 'success');
    console.log('✅ TEST H PASSED: Google Provider segue rigorosamente a mesma arquitetura de auth e teste.');

    // =========================================================================
    // TEST I: Isolamento Multi-Loja (Store A não acessa Store B)
    // =========================================================================
    console.log('\n[TEST I] Isolamento Multi-Loja: Store Alpha vs Store Beta...');
    // Set credential for Store Beta
    await makeRequest(
      baseUrl,
      '/api/store/store-beta/providers/perfectcorp/credentials',
      'PUT',
      { Authorization: 'Bearer jwt-token-beta' },
      { apiKey: 'pc_key_beta_only_5544' }
    );

    const keyAlphaGoogle = await credentialService.getCredential('store-alpha', 'google');
    const keyBetaPC = await credentialService.getCredential('store-beta', 'perfectcorp');
    const keyBetaGoogle = await credentialService.getCredential('store-beta', 'google');

    assert.strictEqual(keyAlphaGoogle, 'google_ai_live_sk_alpha_4321');
    assert.strictEqual(keyBetaPC, 'pc_key_beta_only_5544');
    assert.strictEqual(keyBetaGoogle, null, 'Store Beta must not have Google key set');

    // Attempt Cross-Store access with Store Alpha owner token on Store Beta
    const resCrossStore = await makeRequest(
      baseUrl,
      '/api/store/store-beta/providers/perfectcorp/credentials',
      'PUT',
      { Authorization: 'Bearer jwt-token-owner' }, // User owner-1 belongs to Alpha, not Beta
      { apiKey: 'pc_key_hacker_attack' }
    );
    assert.strictEqual(resCrossStore.status, 403, 'Cross store access without membership must return 403');
    console.log('✅ TEST I PASSED: Segredos e permissões multi-loja são estritamente isolados.');

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 6.5 PROVIDER AUTH & INTEGRATION TESTS PASSED!');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('❌ Phase 6.5 test execution failed:', err);
  process.exit(1);
});
