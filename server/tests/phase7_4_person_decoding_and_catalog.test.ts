// server/tests/phase7_4_person_decoding_and_catalog.test.ts
import assert from 'assert';
import { CatalogService } from '../services/CatalogService.js';
import { ImagePreparationService } from '../services/ImagePreparationService.js';
import { validateImageFromUrl } from '../utils/imageValidator.js';

async function runPhase7_4Tests() {
  console.log('===============================================================');
  console.log('🚀 EXECUTING FASE 7.4 PERSON DECODING & CATALOG TESTS');
  console.log('===============================================================\n');

  const catalogService = new CatalogService();
  const imagePrepService = ImagePreparationService.getInstance();

  // Minimal valid 1x1 base64 JPEG
  const validJpegBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAEAAQABAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  
  // Minimal valid 1x1 base64 PNG
  const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // Minimal valid WebP buffer
  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // 'RIFF'
    0x1a, 0x00, 0x00, 0x00, // file size
    0x57, 0x45, 0x42, 0x50, // 'WEBP'
    0x56, 0x50, 0x38, 0x20, // 'VP8 '
    0x0e, 0x00, 0x00, 0x00, // chunk size
    0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, // VP8 frame header
    0x10, 0x00, 0x10, 0x00, // 16x16 px
    0x00, 0x34, 0x25, 0xa4
  ]);
  const validWebpBase64 = `data:image/webp;base64,${validWebpBuffer.toString('base64')}`;

  // Corrupted / non-image string
  const corruptedBase64 = 'data:image/jpeg;base64,bm90YW5pbWFnZWF0YWxs'; // "notanimageatall"
  const emptyBase64 = 'data:image/jpeg;base64,';

  // TEST 1: Permissive Person Photo Validation
  console.log('--- TEST 1: Permissive Person Photo Validation ---');

  const jpegResult = await imagePrepService.analyzeAndValidatePerson(validJpegBase64);
  assert.strictEqual(jpegResult.valid, true, 'Valid JPEG person photo must pass validation');
  assert.strictEqual(jpegResult.errorCode, null, 'Error code must be null');
  console.log('✅ JPEG person photo passed validation successfully.');

  const pngResult = await imagePrepService.analyzeAndValidatePerson(validPngBase64);
  assert.strictEqual(pngResult.valid, true, 'Valid PNG person photo must pass validation');
  assert.strictEqual(pngResult.errorCode, null, 'Error code must be null');
  console.log('✅ PNG person photo passed validation successfully.');

  const webpResult = await imagePrepService.analyzeAndValidatePerson(validWebpBase64);
  assert.strictEqual(webpResult.valid, true, 'Valid WebP person photo must pass validation');
  assert.strictEqual(webpResult.errorCode, null, 'Error code must be null');
  console.log('✅ WebP person photo passed validation successfully.');

  // TEST 2: True Corrupt / Empty File Detection
  console.log('\n--- TEST 2: Corrupt & Empty File Blocking ---');

  const corruptResult = await imagePrepService.analyzeAndValidatePerson(corruptedBase64);
  assert.strictEqual(corruptResult.valid, false, 'Corrupted base64 must fail validation');
  assert.strictEqual(corruptResult.errorCode, 'INVALID_PERSON_IMAGE_FORMAT', 'Should return INVALID_PERSON_IMAGE_FORMAT');
  console.log('✅ Corrupted image properly blocked without crashing.');

  const emptyResult = await imagePrepService.analyzeAndValidatePerson(emptyBase64);
  assert.strictEqual(emptyResult.valid, false, 'Empty base64 must fail validation');
  assert.strictEqual(emptyResult.errorCode, 'INVALID_PERSON_IMAGE_FORMAT', 'Should return INVALID_PERSON_IMAGE_FORMAT');
  console.log('✅ Empty image properly blocked.');

  // TEST 3: Garment vs Person Validation Separation
  console.log('\n--- TEST 3: Garment vs Person Validation Separation ---');

  const personCheck = await validateImageFromUrl(validJpegBase64, {
    label: 'Pessoa',
    isPerson: true,
  });
  assert.strictEqual(personCheck.valid, true, 'Person check must bypass strict dimensions');

  const garmentCheck = await validateImageFromUrl(validJpegBase64, {
    label: 'Roupa',
    isPerson: false,
  });
  assert.strictEqual(garmentCheck.valid, false, 'Garment check must maintain strict dimension enforcement');
  console.log('✅ Person vs Garment validation distinction verified.');

  // TEST 4: Diverse Catalog Seeding (Men & Women)
  console.log('\n--- TEST 4: Diverse Catalog Seeding ---');

  const storeId = `store-test-diverse-${Date.now()}`;
  const products = await catalogService.getStoreProducts(storeId);

  assert.ok(products.length >= 10, `Catalog should have at least 10 items, found ${products.length}`);
  
  const productNames = products.map(p => p.name.toLowerCase());
  const hasMaleTshirt = productNames.some(n => n.includes('camiseta'));
  const hasMaleShirt = productNames.some(n => n.includes('camisa'));
  const hasMalePolo = productNames.some(n => n.includes('polo'));
  const hasMaleJeans = productNames.some(n => n.includes('jeans'));
  const hasMaleChino = productNames.some(n => n.includes('chino'));
  const hasMaleBomber = productNames.some(n => n.includes('bomber'));
  const hasMaleBlazer = productNames.some(n => n.includes('blazer'));
  const hasMaleSneakers = productNames.some(n => n.includes('tênis'));

  const hasFemaleDress = productNames.some(n => n.includes('vestido'));
  const hasFemaleSkirt = productNames.some(n => n.includes('saia'));
  const hasFemaleCropped = productNames.some(n => n.includes('cropped'));

  assert.ok(hasMaleTshirt && hasMaleShirt && hasMalePolo, 'Should contain male tops');
  assert.ok(hasMaleJeans && hasMaleChino, 'Should contain male bottoms');
  assert.ok(hasMaleBomber || hasMaleBlazer, 'Should contain male outerwear');
  assert.ok(hasMaleSneakers, 'Should contain male footwear');
  assert.ok(hasFemaleDress && hasFemaleSkirt && hasFemaleCropped, 'Should contain female pieces');

  products.forEach(p => {
    assert.strictEqual(p.storeId, storeId, 'Each product must belong to current store');
    assert.ok(p.id && p.id.length > 10, 'Product must have valid UUID');
    assert.ok(p.photos && p.photos.length > 0, 'Product must have catalog photo');
    assert.ok(p.photos[0].storagePath.startsWith('http'), 'Product photo must have valid URL');
  });
  console.log(`✅ Store catalog seeded with ${products.length} diverse masculine & feminine pieces.`);

  // TEST 5: Multi-Tenant Store Isolation
  console.log('\n--- TEST 5: Multi-Tenant Store Isolation ---');

  const storeA = `store-tenant-alpha-${Date.now()}`;
  const storeB = `store-tenant-beta-${Date.now()}`;

  const productsA = await catalogService.getStoreProducts(storeA);
  const productsB = await catalogService.getStoreProducts(storeB);

  productsA.forEach(p => assert.strictEqual(p.storeId, storeA));
  productsB.forEach(p => assert.strictEqual(p.storeId, storeB));

  const idsB = new Set(productsB.map(p => p.id));
  productsA.forEach(p => assert.ok(!idsB.has(p.id), 'Store A IDs must not collide with Store B IDs'));
  console.log('✅ Multi-tenant isolation between stores verified.');

  // TEST 6: Store CRUD Integrity
  console.log('\n--- TEST 6: Store CRUD Integrity ---');

  const storeCrud = `store-crud-${Date.now()}`;
  const created = await catalogService.createProduct({
    storeId: storeCrud,
    name: 'Camisa Linho Customizada Teste',
    description: 'Camisa exclusiva criada pelo lojista',
    category: 'upper_body',
    garmentType: 'shirt',
    color: 'Verde Oliva',
    material: '100% Linho',
    fit: 'Regular',
    price: 349.0,
    currency: 'BRL',
    sizes: ['P', 'M', 'G'],
    photos: [
      {
        id: 'photo-crud-1',
        productId: '',
        type: 'catalog',
        storagePath: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80',
        sortOrder: 0,
      },
    ],
  });

  assert.ok(created.id, 'Created product must have an ID');
  const fetched = await catalogService.getProductById(created.id);
  assert.strictEqual(fetched?.name, 'Camisa Linho Customizada Teste');

  const updated = await catalogService.updateProduct(created.id, {
    price: 399.0,
    color: 'Verde Floresta',
  });
  assert.strictEqual(updated.price, 399.0);
  assert.strictEqual(updated.color, 'Verde Floresta');

  const deleted = await catalogService.deleteProduct(created.id);
  assert.strictEqual(deleted, true);

  const afterDelete = await catalogService.getProductById(created.id);
  assert.strictEqual(afterDelete, null);
  console.log('✅ Product CRUD (Create, Read, Update, Delete) works smoothly.');

  console.log('\n===============================================================');
  console.log('🎉 ALL PHASE 7.4 TESTS PASSED PERFECTLY!');
  console.log('===============================================================');
}

runPhase7_4Tests().catch(err => {
  console.error('❌ PHASE 7.4 TESTS FAILED:', err);
  process.exit(1);
});
