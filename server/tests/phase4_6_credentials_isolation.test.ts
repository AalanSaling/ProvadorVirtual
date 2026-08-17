// server/tests/phase4_6_credentials_isolation.test.ts
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { EncryptedFileSecretStore } from '../services/SecretStore.js';
import { StoreCredentialService } from '../services/StoreCredentialService.js';
import { TryOnService } from '../services/TryOnService.js';
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { ITryOnProvider } from '../providers/interfaces/ITryOnProvider.js';
import { TryOnInput, TryOnResult, ExecutionContext, ProviderCapabilities } from '../types/index.js';

async function runPhase46Tests() {
  console.log('--- RUNNING PHASE 4.6 CREDENTIALS ISOLATION & PERSISTENCE TESTS ---');

  const testVaultDir = path.resolve(process.cwd(), 'data', 'test_vaults');
  if (!fs.existsSync(testVaultDir)) {
    fs.mkdirSync(testVaultDir, { recursive: true });
  }
  const testVaultFile = path.join(testVaultDir, `test_vault_${Date.now()}.enc`);

  try {
    // =========================================================================
    // TEST 1: SecretStore Persistence Across Server Restarts
    // =========================================================================
    console.log('\n[TEST 1] SecretStore persistence across server restart simulation...');
    const store1 = new EncryptedFileSecretStore(testVaultFile, 'test-master-key-seed-12345');

    const keyStoreA_PC = 'pc_live_sk_storeA_secret9988';
    const keyStoreA_Google = 'ai_live_sk_storeA_google7766';

    const saveResA1 = await store1.setSecret('store-alpha', 'perfectcorp', keyStoreA_PC);
    const saveResA2 = await store1.setSecret('store-alpha', 'google', keyStoreA_Google);

    assert.strictEqual(saveResA1.masked, '••••••••9988', 'Masked output should show last 4 chars');
    assert.strictEqual(saveResA2.masked, '••••••••7766', 'Masked output should show last 4 chars');

    // Simulate backend server restart: create completely new instance reading from same disk vault
    const storeAfterRestart = new EncryptedFileSecretStore(testVaultFile, 'test-master-key-seed-12345');

    const retrievedA1 = await storeAfterRestart.getSecret('store-alpha', 'perfectcorp');
    const retrievedA2 = await storeAfterRestart.getSecret('store-alpha', 'google');

    assert.strictEqual(retrievedA1, keyStoreA_PC, 'Secret for Perfect Corp must survive server restart and decrypt accurately');
    assert.strictEqual(retrievedA2, keyStoreA_Google, 'Secret for Google must survive server restart and decrypt accurately');
    console.log('✅ TEST 1 PASSED: Secrets persist to disk encrypted and survive server restart.');

    // =========================================================================
    // TEST 2: Per-Store Isolation (Store A vs Store B)
    // =========================================================================
    console.log('\n[TEST 2] Per-store isolation verification...');
    const keyStoreB_PC = 'pc_live_sk_storeB_secret1122';
    const keyStoreB_Google = 'ai_live_sk_storeB_google3344';

    await storeAfterRestart.setSecret('store-beta', 'perfectcorp', keyStoreB_PC);
    await storeAfterRestart.setSecret('store-beta', 'google', keyStoreB_Google);

    const storeA_PC = await storeAfterRestart.getSecret('store-alpha', 'perfectcorp');
    const storeB_PC = await storeAfterRestart.getSecret('store-beta', 'perfectcorp');
    const storeA_Google = await storeAfterRestart.getSecret('store-alpha', 'google');
    const storeB_Google = await storeAfterRestart.getSecret('store-beta', 'google');

    assert.strictEqual(storeA_PC, keyStoreA_PC, 'Store Alpha must receive Key A');
    assert.strictEqual(storeB_PC, keyStoreB_PC, 'Store Beta must receive Key B');
    assert.notStrictEqual(storeA_PC, storeB_PC, 'Store Alpha and Beta secrets must not be identical');
    assert.strictEqual(storeA_Google, keyStoreA_Google, 'Store Alpha Google must receive Key A');
    assert.strictEqual(storeB_Google, keyStoreB_Google, 'Store Beta Google must receive Key B');
    assert.notStrictEqual(storeA_Google, storeB_Google, 'Store Alpha and Beta Google secrets must not collide');

    console.log('✅ TEST 2 PASSED: Store Alpha and Store Beta secrets are strictly isolated.');

    // =========================================================================
    // TEST 3: Dynamic Injection into ExecutionContext via TryOnService
    // =========================================================================
    console.log('\n[TEST 3] ExecutionContext dynamic injection in TryOnService...');

    const capturedContexts: Record<string, ExecutionContext | undefined> = {};

    class SpyTryOnProvider implements ITryOnProvider {
      readonly id: string;
      readonly name: string;
      readonly capabilities: ProviderCapabilities = {
        upperBody: true,
        lowerBody: true,
        fullBody: true,
        shoes: true,
      };

      constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
      }

      async validateConfiguration(context?: Partial<ExecutionContext>): Promise<boolean> {
        return Boolean(context?.storeApiKey);
      }

      async generateTryOn(input: TryOnInput, context?: ExecutionContext): Promise<TryOnResult> {
        capturedContexts[`${input.storeId}:${this.id}`] = context;
        return {
          provider: this.id,
          status: 'success',
          resultImage: `https://storage.example.com/results/${input.storeId}_${this.id}.jpg`,
          providerTaskId: `task_${this.id}_123`,
          errorCode: null,
          errorMessage: null,
          durationMs: 120,
        };
      }
    }

    const spyRegistry = ProviderRegistry.getInstance();
    spyRegistry.reset();
    spyRegistry.register(new SpyTryOnProvider('perfectcorp', 'Spy Perfect Corp'));
    spyRegistry.register(new SpyTryOnProvider('google', 'Spy Google'));

    const credentialService = new StoreCredentialService(storeAfterRestart);
    const tryOnService = new TryOnService(spyRegistry, undefined, credentialService);

    const inputStoreA: TryOnInput = {
      personImage: 'https://storage.example.com/personA.jpg',
      garmentImage: 'https://storage.example.com/garmentA.jpg',
      garmentCategory: 'upper_body',
      storeId: 'store-alpha',
      userId: 'user-001',
    };

    const resStoreA = await tryOnService.executeMultiProviderTryOn(inputStoreA, ['perfectcorp', 'google']);
    assert.strictEqual(resStoreA.overallStatus, 'success');

    const ctxAlphaPC = capturedContexts['store-alpha:perfectcorp'];
    const ctxAlphaGoogle = capturedContexts['store-alpha:google'];

    assert(ctxAlphaPC, 'ExecutionContext for store-alpha:perfectcorp must be created');
    assert.strictEqual(ctxAlphaPC.storeId, 'store-alpha');
    assert.strictEqual(ctxAlphaPC.storeApiKey, keyStoreA_PC, 'Provider must receive store-alpha specific key');

    assert(ctxAlphaGoogle, 'ExecutionContext for store-alpha:google must be created');
    assert.strictEqual(ctxAlphaGoogle.storeId, 'store-alpha');
    assert.strictEqual(ctxAlphaGoogle.storeApiKey, keyStoreA_Google, 'Provider must receive store-alpha specific Google key');

    // Now test Store Beta
    const inputStoreB: TryOnInput = {
      personImage: 'https://storage.example.com/personB.jpg',
      garmentImage: 'https://storage.example.com/garmentB.jpg',
      garmentCategory: 'lower_body',
      storeId: 'store-beta',
      userId: 'user-002',
    };

    const resStoreB = await tryOnService.executeMultiProviderTryOn(inputStoreB, ['perfectcorp', 'google']);
    assert.strictEqual(resStoreB.overallStatus, 'success');

    const ctxBetaPC = capturedContexts['store-beta:perfectcorp'];
    const ctxBetaGoogle = capturedContexts['store-beta:google'];

    assert(ctxBetaPC, 'ExecutionContext for store-beta:perfectcorp must be created');
    assert.strictEqual(ctxBetaPC.storeId, 'store-beta');
    assert.strictEqual(ctxBetaPC.storeApiKey, keyStoreB_PC, 'Provider must receive store-beta specific key');

    assert(ctxBetaGoogle, 'ExecutionContext for store-beta:google must be created');
    assert.strictEqual(ctxBetaGoogle.storeId, 'store-beta');
    assert.strictEqual(ctxBetaGoogle.storeApiKey, keyStoreB_Google, 'Provider must receive store-beta specific Google key');

    console.log('✅ TEST 3 PASSED: Providers dynamically receive store-specific keys via ExecutionContext.');

    // =========================================================================
    // TEST 4: Failure Handling (Unconfigured Store & No Fallback)
    // =========================================================================
    console.log('\n[TEST 4] Unconfigured store failure behavior (no silent fallback)...');

    const inputStoreUnconfigured: TryOnInput = {
      personImage: 'https://storage.example.com/personC.jpg',
      garmentImage: 'https://storage.example.com/garmentC.jpg',
      garmentCategory: 'full_body',
      storeId: 'store-gamma-unconfigured',
      userId: 'user-003',
    };

    const resUnconfigured = await tryOnService.executeMultiProviderTryOn(inputStoreUnconfigured, ['perfectcorp', 'google']);
    assert.strictEqual(resUnconfigured.overallStatus, 'failed', 'Unconfigured store try-on must fail');
    assert.strictEqual(resUnconfigured.results[0].errorCode, 'STORE_PROVIDER_CREDENTIAL_NOT_CONFIGURED');
    assert.strictEqual(resUnconfigured.results[1].errorCode, 'STORE_PROVIDER_CREDENTIAL_NOT_CONFIGURED');

    console.log('✅ TEST 4 PASSED: Unconfigured stores fail cleanly with STORE_PROVIDER_CREDENTIAL_NOT_CONFIGURED.');

    // =========================================================================
    // TEST 5: Disconnect and Deletion
    // =========================================================================
    console.log('\n[TEST 5] Disconnect and deletion from vault...');

    const deleted = await storeAfterRestart.deleteSecret('store-alpha', 'perfectcorp');
    assert.strictEqual(deleted, true, 'deleteSecret must return true');

    const postDeleteSecret = await storeAfterRestart.getSecret('store-alpha', 'perfectcorp');
    assert.strictEqual(postDeleteSecret, null, 'Deleted secret must return null');

    const storeAfterSecondRestart = new EncryptedFileSecretStore(testVaultFile, 'test-master-key-seed-12345');
    const diskDeletedSecret = await storeAfterSecondRestart.getSecret('store-alpha', 'perfectcorp');
    assert.strictEqual(diskDeletedSecret, null, 'Deleted secret must not exist on disk after restart');

    console.log('✅ TEST 5 PASSED: Disconnecting a provider completely purges the secret from memory and disk.');

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 4.6 CREDENTIALS ISOLATION TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    // Cleanup test vault file
    if (fs.existsSync(testVaultFile)) {
      fs.unlinkSync(testVaultFile);
    }
  }
}

runPhase46Tests().catch((err) => {
  console.error('❌ Phase 4.6 tests failed:', err);
  process.exit(1);
});
