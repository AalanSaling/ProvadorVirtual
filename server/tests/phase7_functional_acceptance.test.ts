// server/tests/phase7_functional_acceptance.test.ts
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
import { Product } from '../types/index.js';

async function runPhase7AcceptanceTests() {
  console.log('=====================================================');
  console.log('🚀 EXECUTING PHASE 7.0 & 7.1 ACCEPTANCE TESTS');
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
  // TEST 1 & 2: Store Providers & Credentials
  // ----------------------------------------------------
  console.log('[TEST 1 & 2] Testing Store Providers & Credential Vault...');
  const providersData = await credentialService.getStoreProviders(testStoreId);
  assert(Array.isArray(providersData.providers), 'Providers list should be an array');
  console.log(`✅ TEST 1 & 2 PASSED: Providers resolved for store ${testStoreId}.`);

  // ----------------------------------------------------
  // TEST 3: Fresh Store / Empty Catalog Behavior
  // ----------------------------------------------------
  console.log('\n[TEST 3] Testing Empty Catalog Behavior for a new store...');
  const emptyStoreId = 'store-fresh-brand-new-' + Date.now();
  const emptyProducts = await catalogService.getStoreProducts(emptyStoreId);
  assert.strictEqual(emptyProducts.length, 0, 'New store must have 0 products (NO mock data allowed)');
  console.log('✅ TEST 3 PASSED: Empty store returns [] with zero mock contamination.');

  // ----------------------------------------------------
  // TEST 4 & 5: Real Product Creation (CRUD)
  // ----------------------------------------------------
  console.log('\n[TEST 4 & 5] Testing Real Product Creation with UUID...');
  const sampleCatalogImage = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80';
  const createdProduct = await catalogService.createProduct({
    storeId: testStoreId,
    name: 'Vestido Seda Champagne Real',
    description: 'Vestido longo em seda pura acetinada',
    category: 'full_body',
    garmentType: 'dress',
    color: 'Champagne',
    material: 'Seda',
    fit: 'Regular',
    price: 499.0,
    currency: 'BRL',
    sizes: ['P', 'M', 'G'],
    stock: 5,
    active: true,
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

  assert(createdProduct.id, 'Created product must have a valid ID');
  assert(createdProduct.id.length > 10, 'Product ID must be a real unique identifier');
  assert.notStrictEqual(createdProduct.id, 'prod-001', 'Must NOT be mock prod-001');
  assert.strictEqual(createdProduct.name, 'Vestido Seda Champagne Real');
  assert.strictEqual(createdProduct.storeId, testStoreId);
  console.log(`✅ TEST 4 & 5 PASSED: Product created with Real ID: ${createdProduct.id}`);

  // ----------------------------------------------------
  // TEST 6: Visual Garment Preparation & try_on_reference
  // ----------------------------------------------------
  console.log('\n[TEST 6] Testing Visual Garment Preparation Pipeline...');
  const prepResult = await garmentPrepService.processProductGarmentPreparation(createdProduct.id, testStoreId);
  assert(prepResult.preparedImageUrl, 'Garment preparation must produce preparedImageUrl');
  assert(prepResult.status === 'ready' || prepResult.status === 'needs_review', 'Garment preparation status must be ready or needs_review');
  console.log(`✅ TEST 6 PASSED: Dedicated try_on_reference generated: ${prepResult.preparedImageUrl.substring(0, 50)}...`);

  // ----------------------------------------------------
  // TEST 6.1 (FASE 7.2): Automatic On-Demand Preparation on Unprepared Product
  // ----------------------------------------------------
  console.log('\n[TEST 6.1 - FASE 7.2] Testing Automatic On-Demand Preparation when product has NO try_on_reference...');
  const unPreparedProduct = await catalogService.createProduct({
    storeId: testStoreId,
    name: 'Blusa Linho Cru Automatica',
    description: 'Blusa sem preparação prévia',
    category: 'upper_body',
    garmentType: 'top',
    color: 'Cru',
    price: 299.0,
    photos: [
      {
        id: 'photo-cat-auto-' + Date.now(),
        productId: '',
        type: 'catalog',
        storagePath: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80',
        sortOrder: 0,
      },
    ],
  });

  // Verify that calling getGarmentReferenceForProduct on a product with NO try_on_reference automatically prepares it
  const autoResolvedRef = await garmentPrepService.getGarmentReferenceForProduct(unPreparedProduct.id, testStoreId);
  assert(autoResolvedRef.referenceUrl, 'Automatic on-demand preparation must generate and return referenceUrl');
  assert.strictEqual(autoResolvedRef.product.id, unPreparedProduct.id);
  console.log(`✅ TEST 6.1 (FASE 7.2) PASSED: getGarmentReferenceForProduct automatically prepared product '${unPreparedProduct.id}' on-demand without throwing error!`);

  // Clean up auto test product
  await catalogService.deleteProduct(unPreparedProduct.id);

  // ----------------------------------------------------
  // TEST 7: Query Product by ID & Reference Resolution
  // ----------------------------------------------------
  console.log('\n[TEST 7] Testing getGarmentReferenceForProduct with Real DB ID...');
  const refInfo = await garmentPrepService.getGarmentReferenceForProduct(createdProduct.id, testStoreId);
  assert.strictEqual(refInfo.product.id, createdProduct.id);
  assert(refInfo.referenceUrl, 'Reference URL must be resolved');
  console.log(`✅ TEST 7 PASSED: Reference resolved for product ${createdProduct.id}`);

  // ----------------------------------------------------
  // TEST 8: Try-On Execution Pipeline
  // ----------------------------------------------------
  console.log('\n[TEST 8] Testing Try-On Execution with Real Product ID...');
  const testPersonImage = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1024&q=80';

  console.log(`[TRYON_DIAGNOSTIC] PRODUCT NAME: ${createdProduct.name}`);
  console.log(`[TRYON_DIAGNOSTIC] PRODUCT ID: ${createdProduct.id}`);
  console.log(`[TRYON_DIAGNOSTIC] STORE ID: ${testStoreId}`);

  const tryOnResult = await tryOnService.executeMultiProviderTryOn(
    {
      personImage: testPersonImage,
      garmentImage: refInfo.referenceUrl,
      garmentCategory: createdProduct.category,
      productId: createdProduct.id,
      storeId: testStoreId,
      userId: 'usr-real-test-01',
    },
    ['perfectcorp', 'google']
  );

  assert(tryOnResult.results.length > 0, 'Must produce provider results');
  console.log(`✅ TEST 8 PASSED: Multi-provider execution completed with status: ${tryOnResult.overallStatus}`);

  // ----------------------------------------------------
  // TEST 9 & 10: Product Update & Delete (CRUD Full Cycle)
  // ----------------------------------------------------
  console.log('\n[TEST 9 & 10] Testing Product Update and Delete...');
  const updatedProduct = await catalogService.updateProduct(createdProduct.id, {
    name: 'Vestido Seda Champagne Atualizado',
    price: 520.0,
  });
  assert.strictEqual(updatedProduct.name, 'Vestido Seda Champagne Atualizado');
  assert.strictEqual(updatedProduct.price, 520.0);

  const deleteSuccess = await catalogService.deleteProduct(createdProduct.id);
  assert.strictEqual(deleteSuccess, true, 'Product should be deleted');

  const afterDelete = await catalogService.getProductById(createdProduct.id);
  assert.strictEqual(afterDelete, null, 'Deleted product must not be found');
  console.log('✅ TEST 9 & 10 PASSED: Product update and delete cycle verified.');

  console.log('\n=====================================================');
  console.log('🎉 ALL PHASE 7.0 & 7.1 ACCEPTANCE TESTS COMPLETED SUCCESSFULLY!');
  console.log('=====================================================\n');
}

runPhase7AcceptanceTests().catch(err => {
  console.error('❌ PHASE 7 TEST FAILED:', err);
  process.exit(1);
});
