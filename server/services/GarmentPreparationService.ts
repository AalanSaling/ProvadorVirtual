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
    const catalogPhoto = product.photos?.find(p => p.type === 'catalog');

    if (!tryOnRefPhoto || !tryOnRefPhoto.storagePath) {
      const err = new Error(`PRODUCT_TRY_ON_REFERENCE_NOT_FOUND: Product '${productId}' does not have a dedicated 'try_on_reference' photo configured in database.`);
      (err as unknown as Record<string, string>).code = 'PRODUCT_TRY_ON_REFERENCE_NOT_FOUND';
      throw err;
    }

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
      // Upsert prepared image as try_on_reference in database
      try {
        const existingRef = product.photos?.find(p => p.type === 'try_on_reference');
        if (existingRef?.id) {
          await supabaseAdmin
            .from('product_photos')
            .update({
              storage_path: prepMeta.preparedImageUrl,
            })
            .eq('id', existingRef.id);
        } else {
          await supabaseAdmin.from('product_photos').insert({
            product_id: product.id,
            type: 'try_on_reference',
            storage_path: prepMeta.preparedImageUrl,
            sort_order: 1,
          });
        }
      } catch (dbErr: any) {
        logger.warn('[GarmentPreparation] Could not update product_photos table (offline/mock mode)', {
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
      logger.info(`[GarmentPreparation] No AI segmentation service configured. Using isolated try_on_reference photo for product ${productId}.`);
      return {
        status: 'segmentation_not_implemented',
        referenceUrl,
        segmentationEngine: null,
        isCleanedGarment: false,
        errorCode: 'GARMENT_SEGMENTATION_NOT_IMPLEMENTED',
        message: 'No automated AI garment segmentation engine configured in environment. The dedicated try_on_reference image is preserved.',
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
        status: 'segmentation_not_implemented',
        referenceUrl,
        segmentationEngine: segmentationEngineUrl,
        isCleanedGarment: false,
        errorCode: 'GARMENT_SEGMENTATION_FAILED',
        message: `Failed to segment garment image: ${err.message}`,
      };
    }
  }
}
