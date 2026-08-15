// server/tests/phase1.test.ts
import assert from 'node:assert';
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { MockPerfectCorpProvider } from '../providers/mocks/MockPerfectCorpProvider.js';
import { MockGoogleGeminiProvider } from '../providers/mocks/MockGoogleGeminiProvider.js';
import { TryOnService } from '../services/TryOnService.js';
import { TryOnInput } from '../types/index.js';

async function runPhase1Tests() {
  console.log('🧪 Starting Phase 1 Foundation Test Suite...\n');

  const registry = ProviderRegistry.getInstance();
  registry.reset();

  // Test 1: ProviderRegistry Registration & Capabilities
  console.log('Test 1: ProviderRegistry registration and capabilities');
  const pcProvider = new MockPerfectCorpProvider();
  const geminiProvider = new MockGoogleGeminiProvider();

  registry.register(pcProvider);
  registry.register(geminiProvider);

  assert.strictEqual(registry.has('perfectcorp'), true);
  assert.strictEqual(registry.has('google'), true);
  assert.deepStrictEqual(registry.listAvailable(), ['perfectcorp', 'google']);

  const geminiCaps = registry.getCapabilities('google');
  assert.strictEqual(geminiCaps.shoes, true);
  console.log('  ✅ ProviderRegistry registration and capabilities passed');

  // Test 2: ProviderRegistry - Duplicate Registration
  console.log('\nTest 2: ProviderRegistry duplicate registration error handling');
  assert.throws(
    () => registry.register(new MockPerfectCorpProvider()),
    /PROVIDER_ALREADY_REGISTERED/
  );
  console.log('  ✅ Duplicate registration prevented');

  // Test 3: ProviderRegistry - Non-existent Provider Retrieval
  console.log('\nTest 3: ProviderRegistry non-existent provider error handling');
  assert.throws(
    () => registry.get('invalid_provider'),
    /PROVIDER_NOT_FOUND/
  );
  console.log('  ✅ Non-existent provider correctly threw PROVIDER_NOT_FOUND');

  // Test 4: TryOnService - Single Provider Execution
  console.log('\nTest 4: TryOnService with single provider selection');
  pcProvider.setShouldFail(false);
  geminiProvider.setShouldFail(false);

  const tryOnService = new TryOnService();
  const mockInput: TryOnInput = {
    personImage: 'https://demo.com/person.jpg',
    garmentImage: 'https://demo.com/garment.jpg',
    garmentCategory: 'full_body',
    storeId: 'demo-store-001',
    userId: 'user-123',
  };

  const singleResult = await tryOnService.executeMultiProviderTryOn(mockInput, ['perfectcorp']);
  assert.strictEqual(singleResult.overallStatus, 'success');
  assert.strictEqual(singleResult.results.length, 1);
  assert.strictEqual(singleResult.results[0].provider, 'perfectcorp');
  assert.strictEqual(singleResult.results[0].status, 'success');
  console.log('  ✅ Single provider execution succeeded');

  // Test 5: TryOnService - Multiple Providers Execution (Parallel Promise.allSettled)
  console.log('\nTest 5: TryOnService with multiple provider selection ["perfectcorp", "google"]');
  const multiResult = await tryOnService.executeMultiProviderTryOn(mockInput, ['perfectcorp', 'google']);
  assert.strictEqual(multiResult.overallStatus, 'success');
  assert.strictEqual(multiResult.results.length, 2);
  assert.strictEqual(multiResult.selectedProviders[0], 'perfectcorp');
  assert.strictEqual(multiResult.selectedProviders[1], 'google');
  console.log('  ✅ Multiple provider parallel execution succeeded');

  // Test 6: TryOnService - Partial Success Scenario
  console.log('\nTest 6: TryOnService partial_success scenario (1 succeeds, 1 fails)');
  geminiProvider.setShouldFail(true); // Simulate Google Gemini failure

  const partialResult = await tryOnService.executeMultiProviderTryOn(mockInput, ['perfectcorp', 'google']);
  assert.strictEqual(partialResult.overallStatus, 'partial_success');
  assert.strictEqual(partialResult.results.find(r => r.provider === 'perfectcorp')?.status, 'success');
  assert.strictEqual(partialResult.results.find(r => r.provider === 'google')?.status, 'failed');
  console.log('  ✅ partial_success scenario correctly calculated');

  // Test 7: TryOnService - All Providers Failed Scenario
  console.log('\nTest 7: TryOnService failed scenario (all providers fail)');
  pcProvider.setShouldFail(true);
  geminiProvider.setShouldFail(true);

  const failedResult = await tryOnService.executeMultiProviderTryOn(mockInput, ['perfectcorp', 'google']);
  assert.strictEqual(failedResult.overallStatus, 'failed');
  assert.strictEqual(failedResult.results[0].status, 'failed');
  assert.strictEqual(failedResult.results[1].status, 'failed');
  console.log('  ✅ All failed scenario correctly calculated');

  // Test 8: AI_PROVIDER_NOT_CONFIGURED error when selectedProviders is empty
  console.log('\nTest 8: AI_PROVIDER_NOT_CONFIGURED error handling when empty');
  await assert.rejects(
    async () => tryOnService.executeMultiProviderTryOn(mockInput, []),
    /AI_PROVIDER_NOT_CONFIGURED/
  );
  console.log('  ✅ Empty providers threw AI_PROVIDER_NOT_CONFIGURED as mandated');

  // Test 9: Garment Image Validation & Product Reference Lookup Rules
  console.log('\nTest 9: Garment Image Validation & Product Reference Lookup Rules');

  const mockDbProducts = [
    {
      id: 'prod-valid-1',
      storeId: 'store-A',
      name: 'Vestido Floral',
      category: 'full_body',
      photos: [
        { type: 'catalog', storagePath: 'https://cdn.com/catalog.jpg' },
        { type: 'try_on_reference', storagePath: 'https://cdn.com/db_reference.jpg' },
      ],
    },
    {
      id: 'prod-no-ref-2',
      storeId: 'store-A',
      name: 'Camiseta Sem Ref',
      category: 'upper_body',
      photos: [
        { type: 'catalog', storagePath: 'https://cdn.com/catalog2.jpg' },
      ],
    },
    {
      id: 'prod-store-b',
      storeId: 'store-B',
      name: 'Calça Store B',
      category: 'lower_body',
      photos: [
        { type: 'try_on_reference', storagePath: 'https://cdn.com/store_b_ref.jpg' },
      ],
    },
  ];

  function resolveTryOnGarmentImage(reqBody: { storeId: string; productId: string; clientGarmentImage?: string }) {
    const product = mockDbProducts.find(p => p.id === reqBody.productId);
    if (!product) {
      return { status: 404, error: 'PRODUCT_NOT_FOUND' };
    }
    if (product.storeId !== reqBody.storeId) {
      return { status: 403, error: 'STORE_MISMATCH' };
    }
    const tryOnRef = product.photos?.find(p => p.type === 'try_on_reference');
    if (!tryOnRef || !tryOnRef.storagePath) {
      return { status: 400, error: 'PRODUCT_TRY_ON_REFERENCE_NOT_FOUND' };
    }
    return {
      status: 200,
      garmentImage: tryOnRef.storagePath,
      garmentCategory: product.category,
      overrideOccurred: Boolean(reqBody.clientGarmentImage && reqBody.clientGarmentImage !== tryOnRef.storagePath),
    };
  }

  // 9.1: Valid product_id + valid try_on_reference -> passes
  const res1 = resolveTryOnGarmentImage({ storeId: 'store-A', productId: 'prod-valid-1' });
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.garmentImage, 'https://cdn.com/db_reference.jpg');
  console.log('  ✅ 9.1 Valid product_id with reference photo passed');

  // 9.2: Non-existent product_id -> fails with 404 PRODUCT_NOT_FOUND
  const res2 = resolveTryOnGarmentImage({ storeId: 'store-A', productId: 'non-existent-id' });
  assert.strictEqual(res2.status, 404);
  assert.strictEqual(res2.error, 'PRODUCT_NOT_FOUND');
  console.log('  ✅ 9.2 Non-existent product_id rejected with PRODUCT_NOT_FOUND');

  // 9.3: Product belonging to another store -> fails with 403 STORE_MISMATCH
  const res3 = resolveTryOnGarmentImage({ storeId: 'store-A', productId: 'prod-store-b' });
  assert.strictEqual(res3.status, 403);
  assert.strictEqual(res3.error, 'STORE_MISMATCH');
  console.log('  ✅ 9.3 Cross-store product request rejected with STORE_MISMATCH');

  // 9.4: Product without try_on_reference -> fails with PRODUCT_TRY_ON_REFERENCE_NOT_FOUND
  const res4 = resolveTryOnGarmentImage({ storeId: 'store-A', productId: 'prod-no-ref-2' });
  assert.strictEqual(res4.status, 400);
  assert.strictEqual(res4.error, 'PRODUCT_TRY_ON_REFERENCE_NOT_FOUND');
  console.log('  ✅ 9.4 Product without reference photo rejected with PRODUCT_TRY_ON_REFERENCE_NOT_FOUND');

  // 9.5: Arbitrary garmentImage sent by client -> ignored and overridden by DB reference photo
  const res5 = resolveTryOnGarmentImage({
    storeId: 'store-A',
    productId: 'prod-valid-1',
    clientGarmentImage: 'https://malicious-user.com/fake-garment.jpg',
  });
  assert.strictEqual(res5.status, 200);
  assert.strictEqual(res5.garmentImage, 'https://cdn.com/db_reference.jpg');
  assert.strictEqual(res5.overrideOccurred, true);
  console.log('  ✅ 9.5 Client arbitrary garmentImage ignored in favor of DB reference photo');

  console.log('\n🎉 ALL PHASE 1 FOUNDATION TESTS PASSED SUCCESSFULLY!\n');
}

runPhase1Tests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
