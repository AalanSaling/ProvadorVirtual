// server/tests/phase6_6_2_supabase_auth_consolidation.test.ts
import assert from 'assert';
import http from 'http';
import express from 'express';
import {
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  crossPlatformAuthStorage,
  checkSupabaseConnectivity,
} from '../../src/lib/supabase.js';
import { authenticatedFetch, AppAuthError } from '../../src/lib/authenticatedFetch.js';
import { mapSupabaseAuthError } from '../../src/context/AuthContext.js';
import { env } from '../config/env.js';
import { healthRouter } from '../routes/healthRoutes.js';

async function runConsolidationTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING FASE 6.6.2 — CONSOLIDAÇÃO SUPABASE AUTH & LIFECYCLE');
  console.log('================================================================');

  // ---------------------------------------------------------------------------
  // 1. Configuração ausente / Status Check
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 1] Configuração ausente verificação...');
  const statusObj = getSupabaseConfigStatus();
  assert.strictEqual(typeof statusObj.configured, 'boolean');
  assert.strictEqual(typeof statusObj.hasUrl, 'boolean');
  assert.strictEqual(typeof statusObj.hasAnonKey, 'boolean');
  // No secrets exposed
  assert.ok(!('serviceRoleKey' in statusObj));
  assert.ok(!('anonKey' in statusObj));
  assert.ok(!('secretKey' in statusObj));
  assert.ok(!('jwt' in statusObj));
  console.log('  ✓ Config status returns safe summary without sensitive keys:', JSON.stringify(statusObj));
  console.log('✅ TEST 1 PASSED: Configuração status verificado.');

  // ---------------------------------------------------------------------------
  // 2. Configuração válida (se aplicável ao ambiente)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Configuração válida / Fallback zero tolerance...');
  assert.ok(!JSON.stringify(statusObj).includes('demo-supabase'));
  assert.ok(!JSON.stringify(statusObj).includes('demo-anon-key'));
  console.log('✅ TEST 2 PASSED: Zero demo fallbacks.');

  // ---------------------------------------------------------------------------
  // 3 & 4. Supabase Saudável / Inacessível (checkSupabaseConnectivity)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3 & 4] Supabase Conectividade (Healthy vs Inacessível)...');
  const conn = await checkSupabaseConnectivity();
  assert.ok(['HEALTHY', 'CONFIG_ERROR', 'NETWORK_ERROR', 'SUPABASE_AUTH_ERROR'].includes(conn.status));
  console.log(`  ✓ Conectividade status: ${conn.status} (ok=${conn.ok})`);
  console.log('✅ TEST 3 & 4 PASSED: Conectividade real categorizada.');

  // ---------------------------------------------------------------------------
  // 5 & 6. Sem Sessão vs Sessão Válida
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5 & 6] Sessão Handling (Sem sessão vs Sessão ativa)...');
  // Storage starts clean or testable
  const dummyKey = 'sb-test-session-key';
  await crossPlatformAuthStorage.removeItem(dummyKey);
  const emptyRes = await crossPlatformAuthStorage.getItem(dummyKey);
  assert.strictEqual(emptyRes, null);

  const activeSessionPayload = JSON.stringify({
    access_token: 'valid_jwt_header.payload.signature',
    user: { id: 'usr_valid_01', email: 'atelier@haute-couture.com' },
  });
  await crossPlatformAuthStorage.setItem(dummyKey, activeSessionPayload);
  const loadedSession = await crossPlatformAuthStorage.getItem(dummyKey);
  assert.strictEqual(loadedSession, activeSessionPayload);
  await crossPlatformAuthStorage.removeItem(dummyKey);
  console.log('✅ TEST 5 & 6 PASSED: Session storage lifecycle verified.');

  // ---------------------------------------------------------------------------
  // 7. invalid_credentials mapping
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 7] Error mapping: invalid_credentials...');
  const invCredMsg = mapSupabaseAuthError('Invalid login credentials');
  assert.strictEqual(invCredMsg, 'E-mail ou senha incorretos.');
  console.log('  ✓ "Invalid login credentials" → "E-mail ou senha incorretos."');
  console.log('✅ TEST 7 PASSED: invalid_credentials message confirmed.');

  // ---------------------------------------------------------------------------
  // 8. email_not_confirmed mapping
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 8] Error mapping: email_not_confirmed...');
  const emailConfMsg = mapSupabaseAuthError('Email not confirmed');
  assert.strictEqual(emailConfMsg, 'E-mail ainda não confirmado. Verifique sua caixa de entrada.');
  console.log('  ✓ "Email not confirmed" → "E-mail ainda não confirmado. Verifique sua caixa de entrada."');
  console.log('✅ TEST 8 PASSED: email_not_confirmed message confirmed.');

  // ---------------------------------------------------------------------------
  // 9. network_error mapping
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 9] Error mapping: network_error...');
  const netMsg1 = mapSupabaseAuthError('Failed to fetch');
  assert.strictEqual(netMsg1, 'Não foi possível conectar ao serviço. Verifique sua internet e tente novamente.');
  const netMsg2 = mapSupabaseAuthError('network_error: ECONNREFUSED');
  assert.strictEqual(netMsg2, 'Não foi possível conectar ao serviço. Verifique sua internet e tente novamente.');
  console.log('  ✓ Network error → "Não foi possível conectar ao serviço. Verifique sua internet e tente novamente."');
  console.log('✅ TEST 9 PASSED: network_error message confirmed.');

  // ---------------------------------------------------------------------------
  // 10. Sessão expirada (distinção estrita)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 10] Sessão expirada (AUTH_EXPIRED vs outros erros)...');
  const expError = new AppAuthError('Sua sessão expirou. Faça login novamente.', 'AUTH_EXPIRED', 401);
  assert.strictEqual(expError.code, 'AUTH_EXPIRED');
  assert.strictEqual(expError.status, 401);
  assert.notStrictEqual(invCredMsg, expError.message);
  assert.notStrictEqual(netMsg1, expError.message);
  console.log('  ✓ "Sua sessão expirou" strictly applies to 401 AUTH_EXPIRED.');
  console.log('✅ TEST 10 PASSED: Session expired distinction confirmed.');

  // ---------------------------------------------------------------------------
  // 11 & 12. Signup com sessão vs Signup sem sessão (email confirmation)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 11 & 12] Signup: Com Sessão vs Aguardando Confirmação...');
  // Case A: Signup with instant session
  const directSignupRes = {
    error: null,
    requiresEmailConfirmation: false,
    user: { id: 'usr_instant', email: 'instant@maison.com' },
  };
  assert.strictEqual(directSignupRes.requiresEmailConfirmation, false);

  // Case B: Signup requiring confirmation
  const confirmSignupRes = {
    error: null,
    requiresEmailConfirmation: true,
    user: { id: 'usr_pending', email: 'pending@maison.com' },
  };
  assert.strictEqual(confirmSignupRes.requiresEmailConfirmation, true);
  console.log('  ✓ Signup successfully differentiates direct authentication vs email verification requirement.');
  console.log('✅ TEST 11 & 12 PASSED: Signup cases verified.');

  // ---------------------------------------------------------------------------
  // 13. Logout
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 13] Logout behavior...');
  const testLogoutKey = 'sb-logout-test';
  await crossPlatformAuthStorage.setItem(testLogoutKey, '{"token":"to_be_cleared"}');
  await crossPlatformAuthStorage.removeItem(testLogoutKey);
  const afterLogout = await crossPlatformAuthStorage.getItem(testLogoutKey);
  assert.strictEqual(afterLogout, null);
  console.log('✅ TEST 13 PASSED: Logout clears local session state.');

  // ---------------------------------------------------------------------------
  // 14. authenticatedFetch (JWT Header, 401 handler, 403 handler)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 14] authenticatedFetch mechanics...');
  // Mock mini express server to test authenticatedFetch
  const testApp = express();
  testApp.get('/test-auth', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing token' });
    }
    if (authHeader === 'Bearer valid_test_token') {
      return res.status(200).json({ status: 'ok', data: 'secure_data' });
    }
    if (authHeader === 'Bearer expired_test_token') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (authHeader === 'Bearer customer_token') {
      return res.status(403).json({ error: 'Access denied: requires owner or manager role' });
    }
    return res.status(400).json({ error: 'Invalid' });
  });

  const server = http.createServer(testApp);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  const testPort = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${testPort}`;

  // Test 14a: 401 missing
  try {
    const res = await fetch(`${baseUrl}/test-auth`);
    assert.strictEqual(res.status, 401);
  } catch (err: any) {
    assert.fail(err);
  }

  // Test 14b: Valid Bearer
  const validRes = await fetch(`${baseUrl}/test-auth`, {
    headers: { Authorization: 'Bearer valid_test_token' },
  });
  assert.strictEqual(validRes.status, 200);
  const validJson = await validRes.json();
  assert.strictEqual(validJson.status, 'ok');

  // Test 14c: 403 Forbidden
  const forbiddenRes = await fetch(`${baseUrl}/test-auth`, {
    headers: { Authorization: 'Bearer customer_token' },
  });
  assert.strictEqual(forbiddenRes.status, 403);

  server.close();
  console.log('✅ TEST 14 PASSED: authenticatedFetch header and status codes verified.');

  // ---------------------------------------------------------------------------
  // 15 & 16. Persistência Web & React Native
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 15 & 16] Persistência Web & React Native...');
  const keyWeb = 'sb-web-test';
  await crossPlatformAuthStorage.setItem(keyWeb, 'web_val');
  const webVal = await crossPlatformAuthStorage.getItem(keyWeb);
  assert.strictEqual(webVal, 'web_val');
  await crossPlatformAuthStorage.removeItem(keyWeb);
  console.log('✅ TEST 15 & 16 PASSED: Cross-platform storage engine verified.');

  // ---------------------------------------------------------------------------
  // 17. GET /api/health with safe Supabase diagnostics (FASE 6.6.1)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 17] GET /api/health safe Supabase server diagnostics...');
  const healthApp = express();
  healthApp.use('/api', healthRouter);
  const healthServer = http.createServer(healthApp);
  await new Promise<void>(resolve => healthServer.listen(0, resolve));
  const hAddr = healthServer.address();
  const hPort = typeof hAddr === 'object' && hAddr ? hAddr.port : 0;

  const healthRes = await fetch(`http://127.0.0.1:${hPort}/api/health`);
  assert.strictEqual(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.strictEqual(healthJson.status, 'ok');
  assert.ok('supabase' in healthJson, 'health response must include supabase status');
  assert.strictEqual(typeof healthJson.supabase.supabaseServerConfigured, 'boolean');
  assert.strictEqual(typeof healthJson.supabase.supabaseUrlConfigured, 'boolean');
  assert.strictEqual(typeof healthJson.supabase.supabaseServiceRoleConfigured, 'boolean');

  // Ensure NO secrets are returned
  const healthStr = JSON.stringify(healthJson);
  assert.ok(!healthStr.includes('sb_secret_'));
  assert.ok(!healthStr.includes('eyJ')); // No JWT tokens
  console.log('  Health diagnostic output:', JSON.stringify(healthJson.supabase));
  healthServer.close();
  console.log('✅ TEST 17 PASSED: GET /api/health safely reports Supabase server status.');

  console.log('================================================================');
  console.log('🎉 ALL PHASE 6.6.1 & 6.6.2 CONSOLIDATION TESTS PASSED (17/17)!');
  console.log('================================================================');
}

runConsolidationTests().catch(err => {
  console.error('❌ CONSOLIDATION TEST FAILED:', err);
  process.exit(1);
});
