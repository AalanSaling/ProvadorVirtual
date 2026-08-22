// server/services/GarmentPreparationService.ts
import { CatalogService } from './CatalogService.js';
import { StorageService } from './StorageService.js';
import { ImagePreparationService } from './ImagePreparationService.js';
import { GarmentPreparationResult, GarmentPreparationMetadata, Product } from '../types/index.js';
import { supabaseAdmin } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';

export class GarmentPreparationService {
  private catalogService: CatalogService;
  private storageService: StorageService;
  private imagePrepService: ImagePreparationService;

  constructor(
    catalogService?: CatalogService,
    storageService?: StorageService,
    imagePrepService?: ImagePreparationService
  ) {
    this.catalogService = catalogService || new CatalogService();
    this.storageService = storageService || new StorageService();
    this.imagePrepService = imagePrepService || ImagePreparationService.getInstance();
  }

  /**
   * Retrieves the dedicated `try_on_reference` photo for a product.
   * Guarantees:
   * 1. Product exists and belongs to the given storeId.
   * 2. Resolves photo with type === 'try_on_reference'.
   * 3. NEVER substitutes a raw 'catalog' photo without explicit reference configuration.
   * 4. Converts to a public HTTPS URL.
   */
  public async getGarmentReferenceForProduct(productId: string, storeId: string): Promise<{
    referenceUrl: string;
    product: Product;
    catalogImageUrl: string | null;
  }> {
    const product = await this.catalogService.getProductById(productId);
    if (!product) {
      const err = new Error(`PRODUCT_NOT_FOUND: Product with ID '${productId}' was not found.`);
      (err as unknown as Record<string, string>).code = 'PRODUCT_NOT_FOUND';
      throw err;
    }

    if (product.storeId !== storeId) {
      const err = new Error(`STORE_MISMATCH: Product '${productId}' does not belong to store '${storeId}'.`);
      (err as unknown as Record<string, string>).code = 'STORE_MISMATCH';
      throw err;
    }

    const tryOnRefPhoto = product.photos?.find(p => p.type === 'try_on_reference');
    const catalogPhoto = product.photos?.find(p => p.type === 'catalog') || product.photos?.[0];

    // If try_on_reference already exists, resolve and return it
    if (tryOnRefPhoto && tryOnRefPhoto.storagePath) {
      let referenceUrl = tryOnRefPhoto.storagePath;
      if (!referenceUrl.startsWith('http://') && !referenceUrl.startsWith('https://')) {
        referenceUrl = this.storageService.getPublicUrl(StorageService.BUCKET_PRODUCT_IMAGES, referenceUrl);
      }

      let catalogImageUrl: string | null = null;
      if (catalogPhoto?.storagePath) {
        catalogImageUrl = catalogPhoto.storagePath;
        if (!catalogImageUrl.startsWith('http://') && !catalogImageUrl.startsWith('https://')) {
          catalogImageUrl = this.storageService.getPublicUrl(StorageService.BUCKET_PRODUCT_IMAGES, catalogImageUrl);
        }
      }

      return {
        referenceUrl,
        product,
        catalogImageUrl,
      };
    }

    // If try_on_reference does NOT exist, check if catalog image exists to trigger automatic preparation
    if (!catalogPhoto || !catalogPhoto.storagePath) {
      const err = new Error(`CATALOG_PHOTO_MISSING: O produto '${product.name || productId}' não possui foto cadastrada no catálogo.`);
      (err as unknown as Record<string, string>).code = 'CATALOG_PHOTO_MISSING';
      throw err;
    }

    logger.info(`[GarmentPreparation] No try_on_reference found for product '${productId}'. Triggering automatic on-demand garment preparation pipeline.`);
    const prepMeta = await this.processProductGarmentPreparation(productId, storeId);

    if (prepMeta.status === 'needs_review') {
      const userMessage = 'Esta peça precisa ser revisada antes de ser usada no provador.';
      const err = new Error(userMessage);
      (err as unknown as Record<string, string>).code = 'GARMENT_NEEDS_REVIEW';
      (err as unknown as Record<string, string>).details = userMessage;
      throw err;
    }

    if (prepMeta.status === 'not_configured') {
      const userMessage = 'A preparação automática da peça ainda não está configurada.';
      const err = new Error(userMessage);
      (err as unknown as Record<string, string>).code = 'GARMENT_PREPARATION_NOT_CONFIGURED';
      (err as unknown as Record<string, string>).details = userMessage;
      throw err;
    }

    if (prepMeta.status !== 'ready' || !prepMeta.preparedImageUrl) {
      const userMessage = 'Não conseguimos preparar esta peça automaticamente. Tente usar outra foto com a roupa mais visível.';
      const err = new Error(`GARMENT_PREPARATION_FAILED: ${userMessage}`);
      (err as unknown as Record<string, string>).code = 'GARMENT_PREPARATION_FAILED';
      (err as unknown as Record<string, string>).details = prepMeta.qualityGate?.errorMessage || userMessage;
      throw err;
    }

    let referenceUrl = prepMeta.preparedImageUrl;
    if (!referenceUrl.startsWith('http://') && !referenceUrl.startsWith('https://')) {
      referenceUrl = this.storageService.getPublicUrl(StorageService.BUCKET_PRODUCT_IMAGES, referenceUrl);
    }

    let catalogImageUrl: string | null = catalogPhoto.storagePath;
    if (!catalogImageUrl.startsWith('http://') && !catalogImageUrl.startsWith('https://')) {
      catalogImageUrl = this.storageService.getPublicUrl(StorageService.BUCKET_PRODUCT_IMAGES, catalogImageUrl);
    }

    return {
      referenceUrl,
      product,
      catalogImageUrl,
    };
  }

  /**
   * Pipeline: CATALOG IMAGE -> VISUAL ANALYSIS -> ISOLATION / PREPARATION -> QUALITY GATE -> TRY-ON REFERENCE
   * Performs automated visual preparation using Gemini Image Model (gemini-3.1-flash-image) or segmentation service.
   * Saves the prepared reference as a distinct 'try_on_reference' entity without mutating the original catalog photo.
   */
  public async processProductGarmentPreparation(
    productId: string,
    storeId: string,
    apiKeyOverride?: string
  ): Promise<GarmentPreparationMetadata> {
    const product = await this.catalogService.getProductById(productId);
    if (!product) {
      throw new Error(`PRODUCT_NOT_FOUND: Product with ID '${productId}' was not found.`);
    }
    if (product.storeId !== storeId) {
      throw new Error(`STORE_MISMATCH: Product '${productId}' does not belong to store '${storeId}'.`);
    }

    const catalogPhoto = product.photos?.find(p => p.type === 'catalog') || product.photos?.[0];
    if (!catalogPhoto?.storagePath) {
      throw new Error('CATALOG_PHOTO_MISSING: Produto não possui foto de catálogo para preparação.');
    }

    let catalogImageUrl = catalogPhoto.storagePath;
    if (!catalogImageUrl.startsWith('http://') && !catalogImageUrl.startsWith('https://')) {
      catalogImageUrl = this.storageService.getPublicUrl(StorageService.BUCKET_PRODUCT_IMAGES, catalogImageUrl);
    }

    // Run intelligent garment preparation pipeline
    const prepMeta = await this.imagePrepService.prepareGarment({
      catalogImageUrl,
      category: product.category,
      productId: product.id,
      storeId: product.storeId,
      productName: product.name,
      apiKey: apiKeyOverride,
    });

    if (prepMeta.status === 'ready' && prepMeta.preparedImageUrl) {
      // Upsert prepared image as try_on_reference in database and durable storage only when READY
      try {
        await this.catalogService.updateTryOnReference(product.id, prepMeta.preparedImageUrl);
      } catch (dbErr: any) {
        logger.warn('[GarmentPreparation] Could not update try_on_reference:', {
          error: dbErr.message,
        });
      }
    }

    return prepMeta;
  }

  /**
   * Legacy / Test compatibility method
   */
  public async prepareGarmentFromCatalog(
    productId: string,
    storeId: string
  ): Promise<GarmentPreparationResult> {
    const { referenceUrl, product, catalogImageUrl } = await this.getGarmentReferenceForProduct(productId, storeId);

    const segmentationEngineUrl = process.env.GARMENT_SEGMENTATION_SERVICE_URL;

    if (!segmentationEngineUrl) {
      // If no external segmentation engine, use the AI garment preparation pipeline
      const prepMeta = await this.imagePrepService.prepareGarment({
        catalogImageUrl: catalogImageUrl || referenceUrl,
        category: product.category,
        productId: product.id,
        storeId: product.storeId,
        productName: product.name,
      });

      if (prepMeta.status === 'ready' && prepMeta.preparedImageUrl) {
        return {
          status: 'prepared',
          referenceUrl: prepMeta.preparedImageUrl,
          segmentationEngine: 'gemini-3.1-flash-image',
          isCleanedGarment: true,
        };
      }

      return {
        status: 'failed',
        referenceUrl: null,
        segmentationEngine: null,
        isCleanedGarment: false,
        errorCode: 'GARMENT_PREPARATION_FAILED',
        message: prepMeta.qualityGate?.errorMessage || 'A preparação automática da peça falhou no Quality Gate.',
      };
    }

    try {
      logger.info(`[GarmentPreparation] Sending catalog image to segmentation engine: ${segmentationEngineUrl}`, {
        productId,
        catalogImageUrl,
      });

      const resp = await fetch(`${segmentationEngineUrl}/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: catalogImageUrl || referenceUrl,
          category: product.category,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Segmentation engine returned HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const preparedUrl = data.segmented_image_url || data.result_url;

      if (!preparedUrl) {
        throw new Error('Segmentation engine did not return a valid result URL');
      }

      return {
        status: 'prepared',
        referenceUrl: preparedUrl,
        segmentationEngine: segmentationEngineUrl,
        isCleanedGarment: true,
      };
    } catch (err: any) {
      logger.error('[GarmentPreparation] Error during garment segmentation', err);
      return {
        status: 'failed',
        referenceUrl: null,
        segmentationEngine: segmentationEngineUrl,
        isCleanedGarment: false,
        errorCode: 'GARMENT_SEGMENTATION_FAILED',
        message: `Falha na segmentação da peça: ${err.message}`,
      };
    }
  }
}
