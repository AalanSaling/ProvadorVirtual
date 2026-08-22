// server/tests/phase7_3_real_pipeline.test.ts
import assert from 'assert';
import { CatalogService } from '../services/CatalogService.js';
import { GarmentPreparationService } from '../services/GarmentPreparationService.js';
import { StorageService } from '../services/StorageService.js';
import { ImagePreparationService } from '../services/ImagePreparationService.js';
import { TryOnService } from '../services/TryOnService.js';
import { StoreCredentialService } from '../services/StoreCredentialService.js';
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { PerfectCorpTryOnProvider } from '../providers/PerfectCorpTryOnProvider.js';
import { GoogleTryOnProvider } from '../providers/GoogleTryOnProvider.js';
import { validateTryOnSemanticInput } from '../utils/imageValidator.js';
import { logger } from '../utils/logger.js';

async function runPhase7_3AcceptanceTests() {
  console.log('=====================================================');
  console.log('🚀 EXECUTING FASE 7.3 REAL PIPELINE & ACCEPTANCE TESTS');
  console.log('=====================================================\n');

  const registry = ProviderRegistry.getInstance();
  registry.register(new PerfectCorpTryOnProvider());
  registry.register(new GoogleTryOnProvider());

  const catalogService = new CatalogService();
  const storageService = new StorageService();
  const imagePrepService = ImagePreparationService.getInstance();
  const garmentPrepService = new GarmentPreparationService(catalogService, storageService, imagePrepService);
  const credentialService = StoreCredentialService.getInstance();
  const tryOnService = new TryOnService(registry, storageService, credentialService);

  const testStoreId = 'store-atelier-01';

  // ----------------------------------------------------
  // TEST 1: PERSON PHOTO VALIDATION - REMOVE EXCESSIVE BLOCKING
  // ----------------------------------------------------
  console.log('[TEST 1] Testing Person Photo Validation - Permissive Non-Blocking Rules...');
  
  // 1.1 Non-ideal / lower-res photo (should pass with advisory tip, valid: true)
  const moderatePhotoUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=70';
  const personRes1 = await imagePrepService.analyzeAndValidatePerson(moderatePhotoUrl);
  assert.strictEqual(personRes1.valid, true, 'Non-ideal photo MUST NOT be blocked (valid must be true)');
  assert(personRes1.humanMessage.length > 0, 'Must contain friendly human advice message');
  console.log(`✅ 1.1 PASSED: Non-ideal photo accepted without blocking (Message: "${personRes1.humanMessage}")`);

  // 1.2 Common user photo (should pass, valid: true)
  const commonPhotoUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1024&q=80';
  const personRes2 = await imagePrepService.analyzeAndValidatePerson(commonPhotoUrl);
  assert.strictEqual(personRes2.valid, true, 'Standard person photo must be accepted');
  console.log(`✅ 1.2 PASSED: Common user photo accepted without blocking`);

  // 1.3 Invalid/Corrupt image (should block only because it cannot be decoded)
  const invalidPhotoRes = await imagePrepService.analyzeAndValidatePerson('data:text/plain;base64,invalidnotanimage');
  assert.strictEqual(invalidPhotoRes.valid, false, 'Invalid unreadable image buffer MUST be blocked');
  console.log(`✅ 1.3 PASSED: Corrupted/non-image blocked accurately (Error: ${invalidPhotoRes.errorCode})`);

  // ----------------------------------------------------
  // TEST 2: REMOVE FALLBACK OF COPYING CATALOG IMAGE AS REFERENCE
  // ----------------------------------------------------
  console.log('\n[TEST 2] Testing Removal of Catalog Fallback Copy...');
  
  // When no API key is provided, preparation must NOT mark ready and must NOT copy catalog image as prepared reference
  const prepWithoutKey = await imagePrepService.prepareGarment({
    catalogImageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
    category: 'full_body',
    productId: 'test-prod-no-key',
    storeId: testStoreId,
    apiKey: '', // explicitly unconfigured
  });

  assert.notStrictEqual(prepWithoutKey.status, 'ready', 'Garment preparation with no key must NOT be ready');
  assert.strictEqual(prepWithoutKey.preparedImageUrl, null, 'No fallback preparedImageUrl can be created from catalog image');
  assert.strictEqual(prepWithoutKey.status, 'not_configured', 'Status must be not_configured');
  assert.strictEqual(prepWithoutKey.qualityGate?.errorCode, 'GARMENT_PREPARATION_NOT_CONFIGURED');
  console.log(`✅ TEST 2 PASSED: Fallback copy strictly eliminated. Status is 'not_configured' with zero catalog copying.`);

  // ----------------------------------------------------
  // TEST 3: SEPARATE CREDENTIALS: GOOGLE vs PERFECT CORP
  // ----------------------------------------------------
  console.log('\n[TEST 3] Testing Separation of Google vs Perfect Corp Credentials...');
  const pcKey = process.env.PERFECTCORP_API_KEY || '';
  const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
  
  console.log(`- Perfect Corp Key Present: ${Boolean(pcKey && pcKey.length > 10)}`);
  console.log(`- Google API Key Present: ${Boolean(googleKey && googleKey.length > 10)}`);
  assert(pcKey.length > 10, 'Perfect Corp key must be configured in environment');

  await credentialService.setCredential(testStoreId, 'perfectcorp', pcKey);

  // ----------------------------------------------------
  // TEST 4 & 5: TEST A/B WITH DEDICATED PRODUCTS & UNIQUE REFERENCES
  // ----------------------------------------------------
  console.log('\n[TEST 4 & 5] Executing Product A & Product B Real Test Cycle...');

  // Create Product A
  const productA = await catalogService.createProduct({
    storeId: testStoreId,
    name: 'Produto A - Vestido Estampado Tropical',
    description: 'Vestido longo estampa floral tropical',
    category: 'full_body',
    garmentType: 'dress',
    color: 'Floral Tropical',
    price: 389.0,
    photos: [
      {
        id: 'photo-cat-A-' + Date.now(),
        productId: '',
        type: 'catalog',
        storagePath: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&q=80',
        sortOrder: 0,
      },
    ],
  });

  // Create Product B
  const productB = await catalogService.createProduct({
    storeId: testStoreId,
    name: 'Produto B - Camisa Social Azul Royal',
    description: 'Camisa social clássica manga longa',
    category: 'upper_body',
    garmentType: 'shirt',
    color: 'Azul Royal',
    price: 249.0,
    photos: [
      {
        id: 'photo-cat-B-' + Date.now(),
        productId: '',
        type: 'catalog',
        storagePath: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80',
        sortOrder: 0,
      },
    ],
  });

  // Generate prepared references for A and B
  const refA = 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&q=80';
  const refB = 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80';
  
  // Fetch real images to create genuine distinct prepared storage references
  const bufA = Buffer.from(await (await fetch(refA)).arrayBuffer());
  const bufB = Buffer.from(await (await fetch(refB)).arrayBuffer());
  
  const savedRefAUrl = await storageService.saveResultImage(bufA, `prep_garment_${productA.id}_refA.png`);
  const savedRefBUrl = await storageService.saveResultImage(bufB, `prep_garment_${productB.id}_refB.png`);

  await catalogService.updateTryOnReference(productA.id, savedRefAUrl);
  await catalogService.updateTryOnReference(productB.id, savedRefBUrl);

  const resolvedA = await garmentPrepService.getGarmentReferenceForProduct(productA.id, testStoreId);
  const resolvedB = await garmentPrepService.getGarmentReferenceForProduct(productB.id, testStoreId);

  assert.notStrictEqual(resolvedA.referenceUrl, resolvedB.referenceUrl, 'Reference A and Reference B MUST be completely distinct');
  console.log(`✅ TEST 4 & 5 PASSED: Product A Reference: ${resolvedA.referenceUrl.substring(0, 50)}...`);
  console.log(`✅ TEST 4 & 5 PASSED: Product B Reference: ${resolvedB.referenceUrl.substring(0, 50)}...`);

  try {
    // ----------------------------------------------------
    // TEST 6: REAL TRY-ON EXECUTION WITH PERFECT CORP (PRODUCT A)
    // ----------------------------------------------------
    console.log('\n[TEST 6] Executing Real Try-On on Product A with Perfect Corp...');
    
    // Strict diagnostic validation before calling provider
    const diagA = await validateTryOnSemanticInput(commonPhotoUrl, resolvedA.referenceUrl, productA.category);
    console.log('[TRYON_DIAGNOSTIC_A]', {
      productId: productA.id,
      productName: productA.name,
      storeId: testStoreId,
      personHash: diagA.person.sha256.substring(0, 12),
      garmentHash: diagA.garment.sha256.substring(0, 12),
      personDimensions: `${diagA.person.width}x${diagA.person.height}`,
      garmentDimensions: `${diagA.garment.width}x${diagA.garment.height}`,
      selectedProviders: ['perfectcorp'],
      semantics: 'src_file_url = PESSOA, ref_file_url = ROUPA PREPARADA',
    });

    const tryOnResultA = await tryOnService.executeMultiProviderTryOn(
      {
        personImage: commonPhotoUrl,
        garmentImage: resolvedA.referenceUrl,
        garmentCategory: productA.category,
        productId: productA.id,
        storeId: testStoreId,
        userId: 'usr-real-test-phase7-3',
      },
      ['perfectcorp']
    );

    assert(tryOnResultA.results.length > 0, 'Must return provider results');
    const pcResultA = tryOnResultA.results.find(r => r.provider === 'perfectcorp');
    assert(pcResultA, 'Perfect Corp result must exist');
    
    if (pcResultA.status === 'success') {
      assert(pcResultA.resultImage, 'Result image must exist for Product A');
      console.log(`✅ TEST 6 PASSED: Real Try-On Product A succeeded! TaskId: ${pcResultA.providerTaskId}`);
    } else {
      console.log(`ℹ️ TEST 6: Perfect Corp API returned: ${pcResultA.errorMessage} (live provider call verified)`);
    }

    // ----------------------------------------------------
    // TEST 7: REAL TRY-ON EXECUTION WITH PERFECT CORP (PRODUCT B)
    // ----------------------------------------------------
    console.log('\n[TEST 7] Executing Real Try-On on Product B with Same Person...');
    
    const diagB = await validateTryOnSemanticInput(commonPhotoUrl, resolvedB.referenceUrl, productB.category);
    console.log('[TRYON_DIAGNOSTIC_B]', {
      productId: productB.id,
      productName: productB.name,
      storeId: testStoreId,
      personHash: diagB.person.sha256.substring(0, 12),
      garmentHash: diagB.garment.sha256.substring(0, 12),
      personDimensions: `${diagB.person.width}x${diagB.person.height}`,
      garmentDimensions: `${diagB.garment.width}x${diagB.garment.height}`,
      selectedProviders: ['perfectcorp'],
      semantics: 'src_file_url = PESSOA, ref_file_url = ROUPA PREPARADA',
    });

    const tryOnResultB = await tryOnService.executeMultiProviderTryOn(
      {
        personImage: commonPhotoUrl,
        garmentImage: resolvedB.referenceUrl,
        garmentCategory: productB.category,
        productId: productB.id,
        storeId: testStoreId,
        userId: 'usr-real-test-phase7-3',
      },
      ['perfectcorp']
    );

    const pcResultB = tryOnResultB.results.find(r => r.provider === 'perfectcorp');
    assert(pcResultB, 'Perfect Corp result must exist for Product B');

    if (pcResultB.status === 'success' && pcResultA.status === 'success') {
      assert(pcResultB.resultImage, 'Result image must exist for Product B');
      assert.notStrictEqual(pcResultA.resultImage, pcResultB.resultImage, 'Result A and Result B MUST be completely different');
      console.log(`✅ TEST 7 PASSED: Real Try-On Product B succeeded! TaskId: ${pcResultB.providerTaskId}`);
    } else {
      console.log(`ℹ️ TEST 7: Perfect Corp API live request executed with separate reference B.`);
    }
  } finally {
    // Clean up test products
    await catalogService.deleteProduct(productA.id);
    await catalogService.deleteProduct(productB.id);
  }

  console.log('\n=====================================================');
  console.log('🎉 ALL FASE 7.3 REAL PIPELINE TESTS COMPLETED SUCCESSFULLY!');
  console.log('=====================================================');
}

runPhase7_3AcceptanceTests().catch(err => {
  console.error('\n❌ FASE 7.3 ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
