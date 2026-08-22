// server/tests/phase7_7_acceptance.test.ts
import assert from 'assert';
import { CatalogService } from '../services/CatalogService.js';
import { GarmentPreparationService } from '../services/GarmentPreparationService.js';
import { StorageService } from '../services/StorageService.js';
import { ImagePreparationService } from '../services/ImagePreparationService.js';
import { TryOnService } from '../services/TryOnService.js';
import { StoreCredentialService } from '../services/StoreCredentialService.js';
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { PerfectCorpTryOnProvider } from '../providers/PerfectCorpTryOnProvider.js';

async function runPhase7_7AcceptanceTests() {
  console.log('=====================================================');
  console.log('🚀 EXECUTING FASE 7.7 ACCEPTANCE TESTS: ALIGN NEEDS_REVIEW & ZERO FALLBACK');
  console.log('=====================================================\n');

  const registry = ProviderRegistry.getInstance();
  registry.register(new PerfectCorpTryOnProvider());

  const catalogService = new CatalogService();
  const storageService = new StorageService();
  const imagePrepService = ImagePreparationService.getInstance();
  const garmentPrepService = new GarmentPreparationService(catalogService, storageService, imagePrepService);
  const credentialService = StoreCredentialService.getInstance();
  const tryOnService = new TryOnService(registry, storageService, credentialService);

  const testStoreId = 'store-atelier-77';
  const sampleCatalogImage = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80';

  // -------------------------------------------------------------------------
  // TEST A: READY -> pode gerar (passed === true, pode usar no VTON)
  // -------------------------------------------------------------------------
  console.log('[TEST A] Testing READY Status (passed === true, try-on reference created, VTON allowed)...');

  const productReady = await catalogService.createProduct({
    storeId: testStoreId,
    name: 'Vestido Seda Ready Test',
    description: 'Vestido com preparação aprovada',
    category: 'full_body',
    garmentType: 'dress',
    price: 450.0,
    photos: [
      {
        id: 'photo-cat-' + Date.now(),
        productId: '',
        type: 'catalog',
        storagePath: sampleCatalogImage,
        sortOrder: 0,
      },
    ],
  });

  const dummyPreparedBuffer = Buffer.from('prepared-garment-bytes-' + Date.now());
  const savedPreparedUrl = await storageService.saveResultImage(
    dummyPreparedBuffer,
    `prep_garment_${productReady.id}_ready.png`
  );

  // Set READY preparation
  await catalogService.updateProduct(productReady.id, {
    garmentPreparation: {
      status: 'ready',
      version: 'v1.3',
      model: 'gemini-3.1-flash-lite-image',
      originalImageUrl: sampleCatalogImage,
      preparedImageUrl: savedPreparedUrl,
      analysis: null,
      qualityGate: {
        passed: true,
        status: 'ready',
        hasSingleGarment: true,
        modelRemoved: true,
        cleanBackground: true,
        minResolutionPassed: true,
        decodableFormat: true,
        colorPreserved: true,
        detailsPreserved: true,
      },
      updatedAt: new Date().toISOString(),
    },
  });
  await catalogService.updateTryOnReference(productReady.id, savedPreparedUrl);

  const resolvedReady = await garmentPrepService.getGarmentReferenceForProduct(productReady.id, testStoreId);
  assert.strictEqual(resolvedReady.referenceUrl.includes('prep_garment_'), true);
  assert.notStrictEqual(resolvedReady.referenceUrl, sampleCatalogImage, 'Reference MUST NOT be catalog image');

  const readyProductInDb = await catalogService.getProductById(productReady.id);
  const tryOnRefPhoto = readyProductInDb?.photos?.find(p => p.type === 'try_on_reference');
  assert.ok(tryOnRefPhoto, 'Product with READY preparation MUST have a try_on_reference photo');

  console.log('✅ TEST A PASSED: READY status has passed=true and generates valid try_on_reference.');

  // -------------------------------------------------------------------------
  // TEST B: NEEDS_REVIEW -> NÃO gera (passed === false, bloqueado)
  // -------------------------------------------------------------------------
  console.log('\n[TEST B] Testing NEEDS_REVIEW Status (passed === false, NO try_on_reference, blocked)...');

  const productReview = await catalogService.createProduct({
    storeId: testStoreId,
    name: 'Blusa Linho Review Test',
    description: 'Blusa que requer revisão manual',
    category: 'upper_body',
    garmentType: 'top',
    price: 180.0,
    photos: [
      {
        id: 'photo-cat-rev-' + Date.now(),
        productId: '',
        type: 'catalog',
        storagePath: sampleCatalogImage,
        sortOrder: 0,
      },
    ],
  });

  // Set NEEDS_REVIEW metadata
  await catalogService.updateProduct(productReview.id, {
    garmentPreparation: {
      status: 'needs_review',
      version: 'v1.3',
      model: 'gemini-3.1-flash-lite-image',
      originalImageUrl: sampleCatalogImage,
      preparedImageUrl: savedPreparedUrl, // review artifact
      analysis: null,
      qualityGate: {
        passed: false, // STRICT: NEEDS_REVIEW must have passed === false
        status: 'needs_review',
        hasSingleGarment: true,
        modelRemoved: true,
        cleanBackground: true,
        minResolutionPassed: true,
        decodableFormat: true,
        colorPreserved: 'unknown',
        detailsPreserved: 'unknown',
        errorMessage: 'Esta peça precisa ser revisada antes de ser usada no provador.',
      },
      updatedAt: new Date().toISOString(),
    },
  });

  const reviewProductInDb = await catalogService.getProductById(productReview.id);
  assert.strictEqual(reviewProductInDb?.garmentPreparation?.qualityGate?.passed, false, 'NEEDS_REVIEW passed MUST be false');

  let reviewBlocked = false;
  let reviewErrorMsg = '';
  try {
    await garmentPrepService.getGarmentReferenceForProduct(productReview.id, testStoreId);
  } catch (err: any) {
    reviewBlocked = true;
    reviewErrorMsg = err.message;
    assert.strictEqual(err.code, 'GARMENT_NEEDS_REVIEW');
  }

  assert.strictEqual(reviewBlocked, true, 'getGarmentReference MUST throw for NEEDS_REVIEW');
  assert.strictEqual(reviewErrorMsg, 'Esta peça precisa ser revisada antes de ser usada no provador.');
  console.log('✅ TEST B PASSED: NEEDS_REVIEW strictly has passed=false and throws GARMENT_NEEDS_REVIEW.');

  // -------------------------------------------------------------------------
  // TEST C: FAILED -> NÃO gera (passed === false, bloqueado)
  // -------------------------------------------------------------------------
  console.log('\n[TEST C] Testing FAILED Status (passed === false, NO try_on_reference, blocked)...');

  const productFailed = await catalogService.createProduct({
    storeId: testStoreId,
    name: 'Calça Jeans Failed Test',
    description: 'Calça cuja preparação falhou',
    category: 'lower_body',
    garmentType: 'jeans',
    price: 299.0,
    photos: [
      {
        id: 'photo-cat-fail-' + Date.now(),
        productId: '',
        type: 'catalog',
        storagePath: sampleCatalogImage,
        sortOrder: 0,
      },
    ],
  });

  await catalogService.updateProduct(productFailed.id, {
    garmentPreparation: {
      status: 'failed',
      version: 'v1.3',
      model: 'gemini-3.1-flash-lite-image',
      originalImageUrl: sampleCatalogImage,
      preparedImageUrl: null,
      analysis: null,
      qualityGate: {
        passed: false,
        status: 'failed',
        hasSingleGarment: false,
        modelRemoved: false,
        cleanBackground: false,
        minResolutionPassed: false,
        decodableFormat: false,
        colorPreserved: false,
        detailsPreserved: false,
        errorCode: 'GARMENT_PREPARATION_FAILED',
        errorMessage: 'Não conseguimos preparar esta peça automaticamente. Tente usar outra foto com a roupa mais visível.',
      },
      updatedAt: new Date().toISOString(),
    },
  });

  let failedBlocked = false;
  try {
    await garmentPrepService.getGarmentReferenceForProduct(productFailed.id, testStoreId);
  } catch (err: any) {
    failedBlocked = true;
    assert.strictEqual(err.code, 'GARMENT_PREPARATION_FAILED');
  }

  assert.strictEqual(failedBlocked, true, 'getGarmentReference MUST throw for FAILED status');
  console.log('✅ TEST C PASSED: FAILED status has passed=false and throws GARMENT_PREPARATION_FAILED.');

  // -------------------------------------------------------------------------
  // TEST D: NOT_CONFIGURED -> NÃO gera (passed === false, bloqueado)
  // -------------------------------------------------------------------------
  console.log('\n[TEST D] Testing NOT_CONFIGURED Status (passed === false, NO try_on_reference, blocked)...');

  const productNotConfig = await catalogService.createProduct({
    storeId: testStoreId,
    name: 'Jaqueta Not Configured Test',
    description: 'Jaqueta sem motor configurado',
    category: 'upper_body',
    garmentType: 'jacket',
    price: 399.0,
    photos: [
      {
        id: 'photo-cat-nc-' + Date.now(),
        productId: '',
        type: 'catalog',
        storagePath: sampleCatalogImage,
        sortOrder: 0,
      },
    ],
  });

  await catalogService.updateProduct(productNotConfig.id, {
    garmentPreparation: {
      status: 'not_configured',
      version: 'v1.3',
      model: 'gemini-3.1-flash-lite-image',
      originalImageUrl: sampleCatalogImage,
      preparedImageUrl: null,
      analysis: null,
      qualityGate: {
        passed: false,
        status: 'not_configured',
        hasSingleGarment: false,
        modelRemoved: false,
        cleanBackground: false,
        minResolutionPassed: false,
        decodableFormat: false,
        colorPreserved: false,
        detailsPreserved: false,
        errorCode: 'GARMENT_PREPARATION_NOT_CONFIGURED',
        errorMessage: 'A preparação automática da peça ainda não está configurada.',
      },
      updatedAt: new Date().toISOString(),
    },
  });

  let notConfigBlocked = false;
  try {
    await garmentPrepService.getGarmentReferenceForProduct(productNotConfig.id, testStoreId);
  } catch (err: any) {
    notConfigBlocked = true;
    assert.strictEqual(err.code, 'GARMENT_PREPARATION_NOT_CONFIGURED');
  }

  assert.strictEqual(notConfigBlocked, true, 'getGarmentReference MUST throw for NOT_CONFIGURED');
  console.log('✅ TEST D PASSED: NOT_CONFIGURED status has passed=false and throws GARMENT_PREPARATION_NOT_CONFIGURED.');

  // -------------------------------------------------------------------------
  // TEST E: GEMINI FALHA -> NUNCA COPIA CATALOG IMAGE (preparedImageUrl = null)
  // -------------------------------------------------------------------------
  console.log('\n[TEST E] Testing that Gemini Failure NEVER copies catalog image...');

  const prepWithoutKey = await imagePrepService.prepareGarment({
    catalogImageUrl: sampleCatalogImage,
    category: 'full_body',
    productId: 'test-prod-no-key',
    storeId: testStoreId,
    apiKey: '', // unconfigured / empty
  });

  assert.strictEqual(prepWithoutKey.preparedImageUrl, null, 'preparedImageUrl MUST be null when AI is unconfigured');
  assert.strictEqual(prepWithoutKey.status, 'not_configured');
  assert.strictEqual(prepWithoutKey.qualityGate?.passed, false);
  assert.notStrictEqual(prepWithoutKey.preparedImageUrl, sampleCatalogImage, 'Catalog image MUST NEVER become prepared image');

  console.log('✅ TEST E PASSED: Gemini failure sets preparedImageUrl=null and never falls back to catalog image.');

  // -------------------------------------------------------------------------
  // TEST F: REFERENCE CRIADA SÓ SE STATUS READY
  // -------------------------------------------------------------------------
  console.log('\n[TEST F] Testing that try_on_reference is attached ONLY when status === READY...');

  const prodTestF = await catalogService.createProduct({
    storeId: testStoreId,
    name: 'Saia Plissada Test F',
    description: 'Saia para verificação de anexação de referência',
    category: 'lower_body',
    price: 220.0,
    photos: [
      {
        id: 'photo-cat-f-' + Date.now(),
        productId: '',
        type: 'catalog',
        storagePath: sampleCatalogImage,
        sortOrder: 0,
      },
    ],
  });

  // Simulating processProductGarmentPreparation with empty key (triggers not_configured)
  const metaF = await garmentPrepService.processProductGarmentPreparation(prodTestF.id, testStoreId, '');
  assert.notStrictEqual(metaF.status, 'ready');

  const prodFAfter = await catalogService.getProductById(prodTestF.id);
  const refPhotosF = prodFAfter?.photos?.filter(p => p.type === 'try_on_reference') || [];
  assert.strictEqual(refPhotosF.length, 0, 'No try_on_reference photo should be attached for non-READY status');

  console.log('✅ TEST F PASSED: Product photos contain zero try_on_reference when preparation is not READY.');

  // Clean up test products
  await catalogService.deleteProduct(productReady.id);
  await catalogService.deleteProduct(productReview.id);
  await catalogService.deleteProduct(productFailed.id);
  await catalogService.deleteProduct(productNotConfig.id);
  await catalogService.deleteProduct(prodTestF.id);

  console.log('\n=====================================================');
  console.log('🎉 ALL FASE 7.7 ACCEPTANCE TESTS COMPLETED SUCCESSFULLY!');
  console.log('=====================================================\n');
}

runPhase7_7AcceptanceTests().catch(err => {
  console.error('❌ Acceptance test failure:', err);
  process.exit(1);
});
