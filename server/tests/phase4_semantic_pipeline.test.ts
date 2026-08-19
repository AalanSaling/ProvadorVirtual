// server/tests/phase4_semantic_pipeline.test.ts
import assert from 'node:assert';
import { GarmentPreparationService } from '../services/GarmentPreparationService.js';
import { PerfectCorpTryOnProvider } from '../providers/PerfectCorpTryOnProvider.js';
import { validateTryOnSemanticInput, validateImageFromUrl, computeSha256 } from '../utils/imageValidator.js';
import { TryOnInput, Product } from '../types/index.js';

console.log('🧪 Starting Phase 4 Semantic Pipeline & VTON Image Architecture Tests...\n');

async function runTests() {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.PERFECTCORP_API_KEY;
  const originalHost = process.env.PERFECTCORP_API_HOST;

  process.env.PERFECTCORP_API_KEY = 'test-perfectcorp-key';
  process.env.PERFECTCORP_API_HOST = 'https://s2s.perfectcorp.com';

  const createPngBuffer = (w: number, h: number, seed = 'A') => {
    const buf = Buffer.alloc(48);
    buf.writeUInt8(0x89, 0); buf.writeUInt8(0x50, 1); buf.writeUInt8(0x4e, 2); buf.writeUInt8(0x47, 3);
    buf.writeUInt8(0x0d, 4); buf.writeUInt8(0x0a, 5); buf.writeUInt8(0x1a, 6); buf.writeUInt8(0x0a, 7);
    buf.writeUInt32BE(13, 8);
    buf.write('IHDR', 12);
    buf.writeUInt32BE(w, 16);
    buf.writeUInt32BE(h, 20);
    buf.write(seed.repeat(16), 24);
    return buf;
  };

  const personBuffer = createPngBuffer(1024, 1536, 'P');
  const garmentBuffer = createPngBuffer(800, 1200, 'G');

  try {
    // -------------------------------------------------------------
    // Test 1: Binary Hash Calculation & Image Validator
    // -------------------------------------------------------------
    console.log('Test 1: Binary Hash (SHA-256) Calculation & Image Metadata');
    const personHash = computeSha256(personBuffer);
    const garmentHash = computeSha256(garmentBuffer);

    assert.ok(personHash.length === 64, 'SHA-256 should be 64 hex characters');
    assert.ok(garmentHash.length === 64, 'SHA-256 should be 64 hex characters');
    assert.notStrictEqual(personHash, garmentHash, 'Person and Garment must have distinct hashes');
    console.log(`  ✅ Person hash: ${personHash.substring(0, 16)}...`);
    console.log(`  ✅ Garment hash: ${garmentHash.substring(0, 16)}...`);

    // -------------------------------------------------------------
    // Test 2: Semantic Input Validation (Distinct Person & Garment)
    // -------------------------------------------------------------
    console.log('\nTest 2: Semantic Input Validation (Distinct Person vs Garment)');
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr === 'https://cdn.example.com/person.png') {
        return new Response(personBuffer, { status: 200, headers: { 'Content-Type': 'image/png' } });
      }
      if (urlStr === 'https://cdn.example.com/garment_reference.png') {
        return new Response(garmentBuffer, { status: 200, headers: { 'Content-Type': 'image/png' } });
      }
      return new Response('Not Found', { status: 404 });
    }) as typeof fetch;

    const validCheck = await validateTryOnSemanticInput(
      'https://cdn.example.com/person.png',
      'https://cdn.example.com/garment_reference.png',
      'full_body'
    );

    assert.strictEqual(validCheck.valid, true);
    assert.strictEqual(validCheck.differentImages, true);
    assert.strictEqual(validCheck.differentHashes, true);
    assert.strictEqual(validCheck.person.width, 1024);
    assert.strictEqual(validCheck.person.height, 1536);
    assert.strictEqual(validCheck.garment.width, 800);
    assert.strictEqual(validCheck.garment.height, 1200);
    assert.strictEqual(validCheck.semanticMapping.src_file_url, 'PERSON');
    assert.strictEqual(validCheck.semanticMapping.ref_file_url, 'GARMENT');
    console.log('  ✅ Semantic input validation passed with distinct hashes and locked direction');

    // -------------------------------------------------------------
    // Test 3: Semantic Collision Detection (Identical URLs or Hashes)
    // -------------------------------------------------------------
    console.log('\nTest 3: Semantic Collision Detection (Identical Person and Garment)');
    // 3.1 Identical URLs
    const sameUrlCheck = await validateTryOnSemanticInput(
      'https://cdn.example.com/person.png',
      'https://cdn.example.com/person.png',
      'full_body'
    );
    assert.strictEqual(sameUrlCheck.valid, false);
    assert.strictEqual(sameUrlCheck.errorCode, 'SEMANTIC_COLLISION_PERSON_EQUALS_GARMENT');
    console.log('  ✅ Identical URLs detected and rejected as SEMANTIC_COLLISION');

    // 3.2 Different URLs but identical binary content
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr === 'https://cdn.example.com/person1.png' || urlStr === 'https://cdn.example.com/person_duplicate.png') {
        return new Response(personBuffer, { status: 200, headers: { 'Content-Type': 'image/png' } });
      }
      return new Response('Not Found', { status: 404 });
    }) as typeof fetch;

    const sameHashCheck = await validateTryOnSemanticInput(
      'https://cdn.example.com/person1.png',
      'https://cdn.example.com/person_duplicate.png',
      'full_body'
    );
    assert.strictEqual(sameHashCheck.valid, false);
    assert.strictEqual(sameHashCheck.errorCode, 'SEMANTIC_COLLISION_PERSON_EQUALS_GARMENT');
    console.log('  ✅ Identical binary hashes detected and rejected as SEMANTIC_COLLISION');

    // -------------------------------------------------------------
    // Test 4: GarmentPreparationService - Separation of Catalog vs Reference
    // -------------------------------------------------------------
    console.log('\nTest 4: GarmentPreparationService - Catalog vs Reference Separation');
    const mockProducts: Product[] = [
      {
        id: 'prod-dress-01',
        storeId: 'store-paris',
        name: 'Vestido Seda Champagne',
        category: 'full_body',
        price: 890,
        currency: 'BRL',
        sizes: ['P', 'M', 'G'],
        stock: 5,
        photos: [
          { type: 'catalog', storagePath: 'https://cdn.example.com/catalog_vitrine_model.jpg' },
          { type: 'try_on_reference', storagePath: 'https://cdn.example.com/try_on_reference_flat.png' },
        ],
      },
      {
        id: 'prod-missing-ref',
        storeId: 'store-paris',
        name: 'Blusa Sem Referencia',
        category: 'upper_body',
        price: 250,
        currency: 'BRL',
        sizes: ['U'],
        stock: 2,
        photos: [
          { type: 'catalog', storagePath: 'https://cdn.example.com/catalog_only.jpg' },
        ],
      },
    ];

    const mockCatalogService: any = {
      getProductById: async (id: string) => mockProducts.find(p => p.id === id) || null,
    };

    const mockStorageService: any = {
      getPublicUrl: (_bucket: string, path: string) => path,
      saveResultImage: async (_buf: Buffer, filename: string) => `https://cdn.example.com/signed_${filename}`,
    };

    const garmentPrepService = new GarmentPreparationService(mockCatalogService, mockStorageService);

    // 4.1 Resolves try_on_reference and NEVER returns catalog image
    const refResult = await garmentPrepService.getGarmentReferenceForProduct('prod-dress-01', 'store-paris');
    assert.strictEqual(refResult.referenceUrl, 'https://cdn.example.com/try_on_reference_flat.png');
    assert.strictEqual(refResult.catalogImageUrl, 'https://cdn.example.com/catalog_vitrine_model.jpg');
    assert.notStrictEqual(refResult.referenceUrl, refResult.catalogImageUrl);
    console.log('  ✅ Garment reference cleanly separated from catalog photo');

    // 4.2 Rejects product with missing try_on_reference
    await assert.rejects(
      async () => garmentPrepService.getGarmentReferenceForProduct('prod-missing-ref', 'store-paris'),
      /PRODUCT_TRY_ON_REFERENCE_NOT_FOUND/
    );
    console.log('  ✅ Missing reference photo strictly rejected with PRODUCT_TRY_ON_REFERENCE_NOT_FOUND');

    // 4.3 Rejects cross-store request
    await assert.rejects(
      async () => garmentPrepService.getGarmentReferenceForProduct('prod-dress-01', 'store-milan'),
      /STORE_MISMATCH/
    );
    console.log('  ✅ Cross-store product request rejected with STORE_MISMATCH');

    // -------------------------------------------------------------
    // Test 5: Segmentation Pipeline Failure Handled Strictly (GARMENT_PREPARATION_FAILED)
    // -------------------------------------------------------------
    console.log('\nTest 5: Garment Preparation Strict Failure Without Fallback');
    delete process.env.GARMENT_SEGMENTATION_SERVICE_URL;

    const prepResult = await garmentPrepService.prepareGarmentFromCatalog('prod-dress-01', 'store-paris');
    assert.strictEqual(prepResult.status, 'failed');
    assert.strictEqual(prepResult.errorCode, 'GARMENT_PREPARATION_FAILED');
    assert.strictEqual(prepResult.isCleanedGarment, false);
    assert.strictEqual(prepResult.referenceUrl, null);
    console.log('  ✅ Strict failure reported GARMENT_PREPARATION_FAILED with null referenceUrl');

    // -------------------------------------------------------------
    // Test 6: Perfect Corp Payload Verification (Absolute Direction Lock)
    // -------------------------------------------------------------
    console.log('\nTest 6: Perfect Corp Payload Verification (Strict Direction Lock)');
    let capturedBody: any = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr === 'https://cdn.example.com/person.png') {
        return new Response(personBuffer, { status: 200, headers: { 'Content-Type': 'image/png' } });
      }
      if (urlStr === 'https://cdn.example.com/try_on_reference_flat.png') {
        return new Response(garmentBuffer, { status: 200, headers: { 'Content-Type': 'image/png' } });
      }
      if (urlStr.includes('/s2s/v2.0/task/cloth-v3') && init?.method === 'POST') {
        capturedBody = JSON.parse(init.body as string);
        return new Response(JSON.stringify({ task_id: 'task-verified-999' }), { status: 200 });
      }
      if (urlStr.includes('/s2s/v2.0/task/cloth-v3/task-verified-999') && init?.method === 'GET') {
        return new Response(JSON.stringify({ status: 'SUCCESS', result_file_url: 'https://cdn.example.com/pc_result.jpg' }), { status: 200 });
      }
      if (urlStr === 'https://cdn.example.com/pc_result.jpg') {
        return new Response(personBuffer, { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    }) as typeof fetch;

    const provider = new PerfectCorpTryOnProvider(mockStorageService);
    const tryOnInput: TryOnInput = {
      personImage: 'https://cdn.example.com/person.png',
      garmentImage: 'https://cdn.example.com/try_on_reference_flat.png',
      garmentCategory: 'full_body',
      storeId: 'store-paris',
      userId: 'user-001',
    };

    const res = await provider.generateTryOn(tryOnInput);
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(capturedBody.src_file_url, 'https://cdn.example.com/person.png', 'src_file_url MUST be person photo');
    assert.strictEqual(capturedBody.ref_file_url, 'https://cdn.example.com/try_on_reference_flat.png', 'ref_file_url MUST be garment reference');
    assert.strictEqual(capturedBody.garment_category, 'full_body');
    console.log('  ✅ Perfect Corp payload strictly locked: src_file_url = PESSOA, ref_file_url = ROUPA');

    console.log('\n🎉 ALL PHASE 4 SEMANTIC PIPELINE TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.PERFECTCORP_API_KEY = originalApiKey;
    process.env.PERFECTCORP_API_HOST = originalHost;
  }
}

runTests().catch(err => {
  console.error('❌ Phase 4 Test Suite Failed:', err);
  process.exit(1);
});
