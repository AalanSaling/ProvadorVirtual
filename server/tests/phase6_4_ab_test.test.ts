// server/tests/phase6_4_ab_test.test.ts
import assert from 'assert';
import { TryOnService } from '../services/TryOnService.js';
import { GarmentPreparationService } from '../services/GarmentPreparationService.js';
import { ImagePreparationService } from '../services/ImagePreparationService.js';
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { StoreCredentialService } from '../services/StoreCredentialService.js';
import { EncryptedFileSecretStore } from '../services/SecretStore.js';
import { ITryOnProvider } from '../providers/interfaces/ITryOnProvider.js';
import { TryOnInput, TryOnResult, ExecutionContext, GarmentCategory } from '../types/index.js';
import { validateTryOnSemanticInput, computeImageBufferSha256 } from '../utils/imageValidator.js';

console.log('================================================================');
console.log('🧪 RUNNING FASE 6.4 — VISUAL INPUT CLOSURE & REAL A/B TEST SUITE');
console.log('================================================================');

// Mock Storage
class MockStorageService {
  async uploadFile(buffer: Buffer, mimeType: string, pathPrefix: string): Promise<string> {
    return `https://storage.atelier.test/${pathPrefix}/file_${Date.now()}.png`;
  }
  async saveResultImage(buffer: Buffer, fileName: string): Promise<string> {
    return `https://storage.atelier.test/results/${fileName}`;
  }
  async getFileBuffer(path: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    return { buffer: Buffer.from('mock-bytes-1234567890'), contentType: 'image/png' };
  }
  createLocalSignedResultUrl(fileKey: string, expiresAt: number): string {
    return `/api/try-on/result/signed/${fileKey}?expires=${expiresAt}`;
  }
  getPublicUrl(bucket: string, path: string): string {
    return `https://storage.atelier.test/${bucket}/${path}`;
  }
}

// 1x1 Transparent PNG and sample distinct base64 images for hashing and decoding tests
const PERSON_IMAGE_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2Nk+M/wHwMDAwMDDA0AIgEC/6d+kioAAAAASUVORK5CYII=';
const GARMENT_A_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2NkYPj/HwMDAwMDGA0AIgEC/34j5eAAAAAASUVORK5CYII=';
const GARMENT_B_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2Nk+M/w/z8DAwMDDA0AIgEC/20+nKAAAAAASUVORK5CYII=';

// Mock Catalog with Product A (first) and Product B (last)
class MockCatalogService {
  private products: Record<string, any> = {
    'prod-A-first': {
      id: 'prod-A-first',
      storeId: 'store-atelier-01',
      name: 'Vestido Seda Noir (Produto A)',
      category: 'full_body',
      photos: [
        { type: 'catalog', storagePath: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80' },
        { type: 'try_on_reference', storagePath: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=90&try_on=A' },
      ],
    },
    'prod-B-last': {
      id: 'prod-B-last',
      storeId: 'store-atelier-01',
      name: 'Casaco Estruturado Velvet (Produto B)',
      category: 'upper_body',
      photos: [
        { type: 'catalog', storagePath: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80' },
        { type: 'try_on_reference', storagePath: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=90&try_on=B' },
      ],
    },
    'prod-broken-prep': {
      id: 'prod-broken-prep',
      storeId: 'store-atelier-01',
      name: 'Peça Sem Preparacao Valida',
      category: 'upper_body',
      photos: [
        { type: 'catalog', storagePath: 'https://images.unsplash.com/photo-broken-catalog?w=600' },
      ],
    },
  };

  async getProductById(productId: string): Promise<any | null> {
    return this.products[productId] || null;
  }
}

// Spy provider that records inputs
class SpyRealProvider implements ITryOnProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities = { upperBody: true, lowerBody: true, fullBody: true, shoes: true };
  public executionLog: Array<{ input: TryOnInput; context?: ExecutionContext }> = [];
  public shouldFail = false;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  async validateConfiguration(context?: Partial<ExecutionContext>): Promise<boolean> {
    return Boolean(context?.storeApiKey);
  }

  async generateTryOn(input: TryOnInput, context?: ExecutionContext): Promise<TryOnResult> {
    this.executionLog.push({ input, context });

    if (this.shouldFail) {
      return {
        provider: this.id,
        status: 'failed',
        resultImage: null,
        providerTaskId: null,
        errorCode: 'PROVIDER_EXECUTION_FAILED',
        errorMessage: 'AI Provider generated failure.',
        durationMs: 150,
      };
    }

    return {
      provider: this.id,
      status: 'success',
      resultImage: `https://storage.atelier.test/results/${this.id}_${Date.now()}.jpg`,
      providerTaskId: `task_${Date.now()}`,
      errorCode: null,
      errorMessage: null,
      durationMs: 400,
    };
  }
}

async function runPhase6_4_Tests() {
  const catalogService = new MockCatalogService();
  const storageService = new MockStorageService();
  const imagePrepService = ImagePreparationService.getInstance();
  const garmentPrepService = new GarmentPreparationService(catalogService as any, storageService as any, imagePrepService);

  const spyPerfectCorp = new SpyRealProvider('perfectcorp', 'Perfect Corp AI Clothes');
  const spyGoogle = new SpyRealProvider('google', 'Google Gemini AI');

  const providerRegistry = ProviderRegistry.getInstance();
  if (!providerRegistry.has('perfectcorp')) providerRegistry.register(spyPerfectCorp);
  if (!providerRegistry.has('google')) providerRegistry.register(spyGoogle);

  const secretStore = new EncryptedFileSecretStore();
  const credentialService = new StoreCredentialService(secretStore);
  StoreCredentialService.setInstance(credentialService);

  // Configure store credentials
  await credentialService.setCredential('store-atelier-01', 'perfectcorp', 'sk_pc_atelier_live_secret_key');
  await credentialService.setCredential('store-atelier-01', 'google', 'AIzaSy_atelier_gemini_live_key');

  const tryOnService = new TryOnService(
    providerRegistry,
    storageService as any,
    credentialService
  );

  console.log('\n[TEST 1] A/B TEST: Product A (First) vs Product B (Last) Execution Isolation');
  {
    // A/B Step 1: Select Product A
    const prodAInfo = await garmentPrepService.getGarmentReferenceForProduct('prod-A-first', 'store-atelier-01');
    assert.strictEqual(prodAInfo.product.id, 'prod-A-first');
    assert.strictEqual(prodAInfo.referenceUrl, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=90&try_on=A');

    // A/B Step 2: Select Product B
    const prodBInfo = await garmentPrepService.getGarmentReferenceForProduct('prod-B-last', 'store-atelier-01');
    assert.strictEqual(prodBInfo.product.id, 'prod-B-last');
    assert.strictEqual(prodBInfo.referenceUrl, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=90&try_on=B');

    // Verification 1: Isolation of Product IDs
    assert.notStrictEqual(prodAInfo.product.id, prodBInfo.product.id, 'Product A and Product B IDs must be distinct.');

    // Verification 2: Isolation of Reference URLs
    assert.notStrictEqual(prodAInfo.referenceUrl, prodBInfo.referenceUrl, 'Garment reference A and B must have distinct URLs.');

    // Verification 3: Reference distinct from catalog image
    assert.notStrictEqual(prodAInfo.referenceUrl, prodAInfo.catalogImageUrl, 'Product A reference must be distinct from catalog photo.');
    assert.notStrictEqual(prodBInfo.referenceUrl, prodBInfo.catalogImageUrl, 'Product B reference must be distinct from catalog photo.');

    console.log('  ✓ Product A and Product B references are distinct and properly isolated from catalog images.');

    // Execute Try-On for Product A
    const resA = await tryOnService.executeMultiProviderTryOn(
      {
        personImage: 'https://images.unsplash.com/photo-person-123',
        garmentImage: prodAInfo.referenceUrl,
        garmentCategory: prodAInfo.product.category,
        productId: prodAInfo.product.id,
        storeId: 'store-atelier-01',
        userId: 'user-ab-tester',
      },
      ['perfectcorp']
    );

    assert.strictEqual(resA.overallStatus, 'success');
    const lastA = spyPerfectCorp.executionLog[spyPerfectCorp.executionLog.length - 1];
    assert.strictEqual(lastA.input.productId, 'prod-A-first');
    assert.strictEqual(lastA.input.garmentImage, prodAInfo.referenceUrl);
    assert.strictEqual(lastA.input.personImage, 'https://images.unsplash.com/photo-person-123');

    console.log('  ✓ Provider request A received Garment Reference A as ref_file_url and Person as src_file_url.');

    // Execute Try-On for Product B
    const resB = await tryOnService.executeMultiProviderTryOn(
      {
        personImage: 'https://images.unsplash.com/photo-person-123',
        garmentImage: prodBInfo.referenceUrl,
        garmentCategory: prodBInfo.product.category,
        productId: prodBInfo.product.id,
        storeId: 'store-atelier-01',
        userId: 'user-ab-tester',
      },
      ['perfectcorp']
    );

    assert.strictEqual(resB.overallStatus, 'success');
    const lastB = spyPerfectCorp.executionLog[spyPerfectCorp.executionLog.length - 1];
    assert.strictEqual(lastB.input.productId, 'prod-B-last');
    assert.strictEqual(lastB.input.garmentImage, prodBInfo.referenceUrl);
    assert.strictEqual(lastB.input.personImage, 'https://images.unsplash.com/photo-person-123');

    // Confirm Provider requests for A and B had different garment inputs
    assert.notStrictEqual(lastA.input.garmentImage, lastB.input.garmentImage);
    console.log('  ✓ Provider request B received Garment Reference B. No cross-pollution.');
  }

  console.log('\n[TEST 2] Content Hash & Collision Check (Person != Garment A != Garment B)');
  {
    const personHash = computeImageBufferSha256(Buffer.from(PERSON_IMAGE_DATA_URI));
    const garmentAHash = computeImageBufferSha256(Buffer.from(GARMENT_A_DATA_URI));
    const garmentBHash = computeImageBufferSha256(Buffer.from(GARMENT_B_DATA_URI));

    assert.notStrictEqual(personHash, garmentAHash, 'Person hash must differ from Garment A hash.');
    assert.notStrictEqual(personHash, garmentBHash, 'Person hash must differ from Garment B hash.');
    assert.notStrictEqual(garmentAHash, garmentBHash, 'Garment A hash must differ from Garment B hash.');

    console.log('  ✓ Person hash:', personHash.slice(0, 16) + '...');
    console.log('  ✓ Garment A hash:', garmentAHash.slice(0, 16) + '...');
    console.log('  ✓ Garment B hash:', garmentBHash.slice(0, 16) + '...');
    console.log('  ✓ All hashes are distinct, no collision detected.');
  }

  console.log('\n[TEST 3] Zero Catalog Fallback Guarantee in Garment Preparation');
  {
    // Test: Image preparation when AI fails to isolate garment must return status: 'failed' and preparedImageUrl: null
    const failedPrep = await imagePrepService.prepareGarment({
      catalogImageUrl: 'https://images.unsplash.com/photo-invalid-failed-garment',
      category: 'upper_body',
      productId: 'prod-fail-test',
      storeId: 'store-atelier-01',
    });

    assert.strictEqual(failedPrep.status, 'failed', 'Status must be failed when AI preparation does not succeed.');
    assert.strictEqual(failedPrep.preparedImageUrl, null, 'preparedImageUrl must be strictly null (never catalogImageUrl).');
    assert.strictEqual(failedPrep.qualityGate?.passed, false, 'Quality gate must fail.');
    assert.strictEqual(failedPrep.qualityGate?.errorCode, 'GARMENT_PREPARATION_FAILED');

    console.log('  ✓ When preparation fails: status = failed, preparedImageUrl = null, errorCode = GARMENT_PREPARATION_FAILED (No catalog fallback).');
  }

  console.log('\n[TEST 4] Quality Gate Rejection of Identity Fallback');
  {
    // Test: If preparedUrl is identical to catalog originalUrl, Quality Gate must reject it
    const fakePreparedResult = await imagePrepService.validateGarmentQuality(
      'https://images.unsplash.com/catalog-photo.jpg',
      'https://images.unsplash.com/catalog-photo.jpg', // identical
      {
        category: 'full_body',
        garmentType: 'dress',
        primaryColor: 'red',
        secondaryColors: [],
        pattern: 'solid',
        hasModelOrPerson: true,
        hasMultipleGarments: false,
        hasComplexBackground: true,
        hasMannequin: false,
        isPartiallyHidden: false,
        isCropped: false,
        hasOverlappingClothing: false,
        hasBackgroundTextOrLogo: false,
        hasReflectionsOrHarshShadows: false,
        isSharp: true,
      }
    );

    assert.strictEqual(fakePreparedResult.passed, false, 'Quality gate must reject identical catalog image.');
    assert.strictEqual(fakePreparedResult.errorCode, 'GARMENT_PREPARATION_FAILED');
    console.log('  ✓ Quality Gate strictly rejects any prepared image that is identical to the catalog photo.');
  }

  console.log('\n[TEST 5] Person Quality Validation & Blocking');
  {
    // Corrupted / unreadable image
    const invalidPerson = await imagePrepService.analyzeAndValidatePerson('data:image/jpeg;base64,not-a-valid-image');
    assert.strictEqual(invalidPerson.valid, false, 'Invalid person photo must be marked valid: false.');
    assert.strictEqual(
      invalidPerson.humanMessage,
      'Escolha uma foto de corpo inteiro, bem iluminada e nítida.',
      'Human error message must advise user properly.'
    );

    console.log('  ✓ Invalid person photo is blocked with message: "Escolha uma foto de corpo inteiro, bem iluminada e nítida."');
  }

  console.log('\n[TEST 6] Real Provider Failure Returns status: failed, resultImage: null (No Fake Success)');
  {
    spyPerfectCorp.shouldFail = true;

    const failedResult = await tryOnService.executeMultiProviderTryOn(
      {
        personImage: 'https://images.unsplash.com/photo-person-123',
        garmentImage: 'https://images.unsplash.com/photo-garment-123',
        garmentCategory: 'full_body',
        productId: 'prod-A-first',
        storeId: 'store-atelier-01',
        userId: 'user-ab-tester',
      },
      ['perfectcorp']
    );

    assert.strictEqual(failedResult.overallStatus, 'failed');
    assert.strictEqual(failedResult.results[0].status, 'failed');
    assert.strictEqual(failedResult.results[0].resultImage, null);
    assert.strictEqual(failedResult.results[0].errorCode, 'PROVIDER_EXECUTION_FAILED');

    console.log('  ✓ Provider failure strictly returns status: failed and resultImage: null. No fake success generated.');
    spyPerfectCorp.shouldFail = false;
  }

  console.log('\n================================================================');
  console.log('🎉 ALL PHASE 6.4 A/B & VISUAL INPUT CLOSURE TESTS PASSED (6/6)');
  console.log('================================================================\n');
}

runPhase6_4_Tests().catch((err) => {
  console.error('\n❌ PHASE 6.4 A/B TEST FAILED:', err);
  process.exit(1);
});
