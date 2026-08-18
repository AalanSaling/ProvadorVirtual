// server/tests/phase6_3_audit.test.ts
import assert from 'assert';
import { TryOnService } from '../services/TryOnService.js';
import { GarmentPreparationService } from '../services/GarmentPreparationService.js';
import { ImagePreparationService } from '../services/ImagePreparationService.js';
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { StoreCredentialService } from '../services/StoreCredentialService.js';
import { EncryptedFileSecretStore } from '../services/SecretStore.js';
import { ITryOnProvider } from '../providers/interfaces/ITryOnProvider.js';
import { TryOnInput, TryOnResult, ExecutionContext, GarmentCategory } from '../types/index.js';
import { ICatalogService } from '../services/interfaces/ICatalogService.js';
import { IStorageService } from '../services/interfaces/IStorageService.js';
import { validateTryOnSemanticInput } from '../utils/imageValidator.js';

console.log('================================================================');
console.log('🔍 RUNNING FASE 6.3 — AUDIT AND CORRECTION VERIFICATION SUITE');
console.log('================================================================');

// Mock in-memory storage and catalog services
class MockStorageService implements IStorageService {
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
}

class MockCatalogService implements ICatalogService {
  private products: Record<string, any> = {
    'prod-dress-A': {
      id: 'prod-dress-A',
      storeId: 'store-audit-01',
      name: 'Vestido Vermelho Gala',
      category: 'full_body',
      photos: [
        { type: 'catalog', storagePath: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80' },
        { type: 'try_on_reference', storagePath: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=90' },
      ],
    },
    'prod-jacket-B': {
      id: 'prod-jacket-B',
      storeId: 'store-audit-01',
      name: 'Jaqueta Couro Biker',
      category: 'upper_body',
      photos: [
        { type: 'catalog', storagePath: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80' },
        { type: 'try_on_reference', storagePath: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=90' },
      ],
    },
    'prod-no-reference-C': {
      id: 'prod-no-reference-C',
      storeId: 'store-audit-01',
      name: 'Camisa Sem Referencia',
      category: 'upper_body',
      photos: [
        { type: 'catalog', storagePath: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80' },
      ],
    },
  };

  async getProductById(productId: string): Promise<any | null> {
    return this.products[productId] || null;
  }
}

class SpyAuditProvider implements ITryOnProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities = { upperBody: true, lowerBody: true, fullBody: true, shoes: true };
  public lastInput: TryOnInput | null = null;
  public lastContext: ExecutionContext | null = null;
  public shouldFail = false;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  async validateConfiguration(context?: Partial<ExecutionContext>): Promise<boolean> {
    return Boolean(context?.storeApiKey);
  }

  async generateTryOn(input: TryOnInput, context?: ExecutionContext): Promise<TryOnResult> {
    this.lastInput = input;
    this.lastContext = context || null;

    if (this.shouldFail) {
      return {
        provider: this.id,
        status: 'failed',
        resultImage: null,
        providerTaskId: null,
        errorCode: 'PROVIDER_EXECUTION_FAILED',
        errorMessage: 'Simulated AI execution failure',
        durationMs: 450,
      };
    }

    return {
      provider: this.id,
      status: 'success',
      resultImage: `https://storage.atelier.test/results/tryon_${this.id}_${input.productId}.png`,
      providerTaskId: `task_${this.id}_${Date.now()}`,
      errorCode: null,
      errorMessage: null,
      durationMs: 1200,
    };
  }
}

async function runAuditTests() {
  const secretStore = new EncryptedFileSecretStore();
  const credentialService = new StoreCredentialService(secretStore);
  StoreCredentialService.setInstance(credentialService);

  // Setup test credentials
  await credentialService.setCredential('store-audit-01', 'audit_pc', 'pc-real-key-audit-12345');
  await credentialService.setCredential('store-audit-01', 'audit_google', 'google-real-key-audit-67890');

  const registry = ProviderRegistry.getInstance();
  const spyPC = new SpyAuditProvider('audit_pc', 'Spy Perfect Corp');
  const spyGoogle = new SpyAuditProvider('audit_google', 'Spy Google');
  if (!registry.has('audit_pc')) registry.register(spyPC);
  if (!registry.has('audit_google')) registry.register(spyGoogle);

  const storageService = new MockStorageService();
  const catalogService = new MockCatalogService();
  const imagePrepService = ImagePreparationService.getInstance();
  const garmentPrepService = new GarmentPreparationService(catalogService, storageService, imagePrepService);
  const tryOnService = new TryOnService(registry, storageService as any, credentialService);

  // TEST 1: Strict Product Isolation (A vs B)
  console.log('[TEST 1] Product A vs Product B reference and execution isolation...');
  const refA = await garmentPrepService.getGarmentReferenceForProduct('prod-dress-A', 'store-audit-01');
  const refB = await garmentPrepService.getGarmentReferenceForProduct('prod-jacket-B', 'store-audit-01');

  assert.strictEqual(refA.referenceUrl, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=90');
  assert.strictEqual(refB.referenceUrl, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=90');
  assert.notStrictEqual(refA.referenceUrl, refB.referenceUrl, 'Reference URLs must be distinct between products');

  const resultA = await tryOnService.executeMultiProviderTryOn({
    personImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    garmentImage: refA.referenceUrl,
    garmentCategory: 'full_body',
    productId: 'prod-dress-A',
    storeId: 'store-audit-01',
    userId: 'user-audit-1',
  }, ['audit_pc']);

  assert.strictEqual(resultA.overallStatus, 'success');
  assert.strictEqual(spyPC.lastInput?.productId, 'prod-dress-A');
  assert.strictEqual(spyPC.lastInput?.garmentImage, refA.referenceUrl);

  const resultB = await tryOnService.executeMultiProviderTryOn({
    personImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    garmentImage: refB.referenceUrl,
    garmentCategory: 'upper_body',
    productId: 'prod-jacket-B',
    storeId: 'store-audit-01',
    userId: 'user-audit-1',
  }, ['audit_pc']);

  assert.strictEqual(resultB.overallStatus, 'success');
  assert.strictEqual(spyPC.lastInput?.productId, 'prod-jacket-B');
  assert.strictEqual(spyPC.lastInput?.garmentImage, refB.referenceUrl);
  console.log('  ✅ TEST 1 PASSED: Product A and B are strictly isolated with dedicated references.');

  // TEST 2: Dynamic Multi-Provider Selection
  console.log('[TEST 2] Dynamic Multi-Provider selection (audit_pc + audit_google)...');
  const multiResult = await tryOnService.executeMultiProviderTryOn({
    personImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    garmentImage: refA.referenceUrl,
    garmentCategory: 'full_body',
    productId: 'prod-dress-A',
    storeId: 'store-audit-01',
    userId: 'user-audit-1',
  }, ['audit_pc', 'audit_google']);

  assert.strictEqual(multiResult.overallStatus, 'success');
  assert.strictEqual(multiResult.results.length, 2);
  assert.strictEqual(multiResult.results[0].provider, 'audit_pc');
  assert.strictEqual(multiResult.results[1].provider, 'audit_google');
  assert.strictEqual(multiResult.results[0].status, 'success');
  assert.strictEqual(multiResult.results[1].status, 'success');
  console.log('  ✅ TEST 2 PASSED: Dynamic multi-provider execution correctly triggered all chosen engines.');

  // TEST 3: No Fake Success on Failure
  console.log('[TEST 3] Failure mode - strictly return failed status without fake image...');
  spyPC.shouldFail = true;
  const failedResult = await tryOnService.executeMultiProviderTryOn({
    personImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    garmentImage: refA.referenceUrl,
    garmentCategory: 'full_body',
    productId: 'prod-dress-A',
    storeId: 'store-audit-01',
    userId: 'user-audit-1',
  }, ['audit_pc']);

  assert.strictEqual(failedResult.overallStatus, 'failed');
  assert.strictEqual(failedResult.results[0].status, 'failed');
  assert.strictEqual(failedResult.results[0].resultImage, null);
  assert.strictEqual(failedResult.results[0].errorCode, 'PROVIDER_EXECUTION_FAILED');
  spyPC.shouldFail = false;
  console.log('  ✅ TEST 3 PASSED: Failure strictly returns status failed with resultImage = null.');

  // TEST 4: Garment Quality Gate - No catalog fallback
  console.log('[TEST 4] Garment Preparation Quality Gate without AI isolation...');
  const qGateFailed = await imagePrepService.validateGarmentQuality(
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600',
    null // No isolated image produced
  );
  assert.strictEqual(qGateFailed.passed, false);
  assert.strictEqual(qGateFailed.errorCode, 'GARMENT_PREPARATION_FAILED');

  const qGateIdentical = await imagePrepService.validateGarmentQuality(
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600' // Identical to catalog = unisolated
  );
  assert.strictEqual(qGateIdentical.passed, false);
  assert.strictEqual(qGateIdentical.errorCode, 'GARMENT_PREPARATION_FAILED');
  console.log('  ✅ TEST 4 PASSED: Garment Quality Gate rejects missing or unisolated catalog photos.');

  // TEST 5: Person Validation strictness
  console.log('[TEST 5] Semantic input equality collision...');
  const sameUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800';
  const collisionCheck = await validateTryOnSemanticInput(sameUrl, sameUrl, 'full_body');
  assert.strictEqual(collisionCheck.valid, false);
  assert.strictEqual(collisionCheck.errorCode, 'SEMANTIC_COLLISION_PERSON_EQUALS_GARMENT');
  console.log('  ✅ TEST 5 PASSED: Semantic equality collision correctly caught.');

  console.log('================================================================');
  console.log('🎉 ALL FASE 6.3 AUDIT TESTS PASSED WITH 100% COMPLIANCE!');
  console.log('================================================================');
}

runAuditTests().catch(err => {
  console.error('❌ Audit test failed:', err);
  process.exit(1);
});
