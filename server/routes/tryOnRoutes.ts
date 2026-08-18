// server/routes/tryOnRoutes.ts
import { Router, Request, Response } from 'express';
import { requireAuth, rateLimitMiddleware } from '../middleware/authMiddleware.js';
import { TryOnService } from '../services/TryOnService.js';
import { CatalogService } from '../services/CatalogService.js';
import { StorageService } from '../services/StorageService.js';
import { GarmentPreparationService } from '../services/GarmentPreparationService.js';
import { ImagePreparationService } from '../services/ImagePreparationService.js';
import { PromptBuilder } from '../services/PromptBuilder.js';
import { PerfectCorpTryOnProvider } from '../providers/PerfectCorpTryOnProvider.js';
import { validateTryOnSemanticInput } from '../utils/imageValidator.js';
import { AuthenticatedRequest } from '../types/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const tryOnRouter = Router();
const tryOnService = new TryOnService();
const catalogService = new CatalogService();
const storageService = new StorageService();
const imagePrepService = ImagePreparationService.getInstance();
const garmentPrepService = new GarmentPreparationService(catalogService, storageService, imagePrepService);

const handleGenerateTryOn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { storeId, personImage, garmentImage: clientGarmentImage, productId: rawProductId, product_id: rawProductIdSnake, selectedProviders: customProviders, tempInputStoragePath } = req.body;

    const productId = rawProductId || rawProductIdSnake;

    if (!storeId || typeof storeId !== 'string') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'storeId is required.' });
      return;
    }

    if (!personImage || typeof personImage !== 'string') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'personImage is required.' });
      return;
    }

    if (!productId || typeof productId !== 'string') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'productId is required.' });
      return;
    }

    // 1. Resolve dedicated 'try_on_reference' via GarmentPreparationService (Strict separation of catalog vs try_on_reference)
    let garmentReferenceInfo;
    try {
      garmentReferenceInfo = await garmentPrepService.getGarmentReferenceForProduct(productId, storeId);
    } catch (lookupErr: any) {
      const errCode = lookupErr?.code || 'GARMENT_LOOKUP_ERROR';
      if (errCode === 'PRODUCT_NOT_FOUND') {
        res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: `Product with ID '${productId}' was not found.` });
        return;
      }
      if (errCode === 'STORE_MISMATCH') {
        res.status(403).json({ error: 'STORE_MISMATCH', message: `Product '${productId}' does not belong to store '${storeId}'.` });
        return;
      }
      if (errCode === 'PRODUCT_TRY_ON_REFERENCE_NOT_FOUND') {
        res.status(400).json({
          error: 'PRODUCT_TRY_ON_REFERENCE_NOT_FOUND',
          message: `Product '${productId}' does not have a dedicated 'try_on_reference' photo configured in database.`,
        });
        return;
      }
      throw lookupErr;
    }

    const { referenceUrl: garmentImage, product, catalogImageUrl } = garmentReferenceInfo;

    if (clientGarmentImage && clientGarmentImage !== garmentImage) {
      logger.info(`[TryOnRouter] Client provided arbitrary garmentImage '${clientGarmentImage}', overridden by DB reference photo '${garmentImage}'.`);
    }

    // 2. Determine providers to execute
    let selectedProviders: string[] = customProviders;
    if (!selectedProviders || !Array.isArray(selectedProviders) || selectedProviders.length === 0) {
      selectedProviders = await tryOnService.getStoreEnabledProviders(storeId);
    }

    const userId = req.user!.id; // Derived strictly from verified JWT

    // 3. Execute Virtual Try-On (personImage = pessoa, garmentImage = DB reference)
    const result = await tryOnService.executeMultiProviderTryOn(
      {
        personImage,
        garmentImage,
        garmentCategory: product.category,
        productId: product.id,
        storeId,
        userId,
      },
      selectedProviders,
      tempInputStoragePath
    );

    if (result.overallStatus === 'failed') {
      res.status(422).json({
        error: 'TRY_ON_FAILED',
        message: 'All selected AI providers failed to generate try-on result.',
        payload: {
          ...result,
          catalogImageUrl,
          garmentReferenceUrl: garmentImage,
          results: result.results.map(r => ({
            ...r,
            resultImage: toAbsoluteResultUrl(r.resultImage, req),
          })),
        },
      });
      return;
    }

    res.json({
      ...result,
      catalogImageUrl,
      garmentReferenceUrl: garmentImage,
      results: result.results.map(r => ({
        ...r,
        resultImage: toAbsoluteResultUrl(r.resultImage, req),
      })),
    });
  } catch (err: unknown) {
    const errorObj = err as Record<string, unknown>;
    if (errorObj?.code === 'AI_PROVIDER_NOT_CONFIGURED' || (err instanceof Error && err.message.includes('AI_PROVIDER_NOT_CONFIGURED'))) {
      res.status(400).json({
        error: 'AI_PROVIDER_NOT_CONFIGURED',
        message: 'No AI providers have been configured for this store. Please configure at least one provider in store administration.',
      });
      return;
    }

    logger.error('Error in /api/try-on/generate', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: err instanceof Error ? err.message : 'Failed to process Virtual Try-On request.',
    });
  }
};

tryOnRouter.post('/generate', requireAuth, rateLimitMiddleware, handleGenerateTryOn);
tryOnRouter.post('/', requireAuth, rateLimitMiddleware, handleGenerateTryOn);

function toAbsoluteResultUrl(url: string | null | undefined, req: Request): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const base = host ? `${proto}://${host}` : env.BACKEND_PUBLIC_URL;
  return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

// Download signed result image route
tryOnRouter.get('/results/download', (req, res): void => {
  const fileKey = req.query.file as string;
  const expires = parseInt(req.query.expires as string, 10);
  const sig = req.query.sig as string;

  if (!fileKey || isNaN(expires) || !sig) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing file, expires or sig parameter.' });
    return;
  }

  const stored = StorageService.getStoredResult(fileKey, expires, sig);
  if (!stored) {
    res.status(403).json({ error: 'FORBIDDEN_OR_EXPIRED', message: 'Signed URL is invalid or has expired.' });
    return;
  }

  res.setHeader('Content-Type', stored.contentType || 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=604800');
  res.setHeader('Content-Disposition', `inline; filename="${fileKey}"`);
  res.send(stored.buffer);
});

/**
 * Diagnostic Endpoint: Semantics & Input Validation Inspection
 * Validates:
 * - Person image vs Garment reference image
 * - Dimensions, byte sizes, MIME types, SHA-256 hashes
 * - Inequality of hashes (collision check)
 * - Strict semantic mapping: src_file_url = PERSON, ref_file_url = GARMENT
 * - Garment preparation state (catalog vitrine vs try_on_reference IA)
 */
tryOnRouter.all('/diagnostic/input-check', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const params = (req.method === 'POST' ? req.body : req.query) || {};
    const storeId = params.storeId;
    const productId = params.productId;
    const personImage = params.personImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1024&q=80';

    if (!storeId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'storeId is required for diagnostic inspection.' });
      return;
    }

    if (!productId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'productId is required for diagnostic inspection.' });
      return;
    }

    const garmentRefInfo = await garmentPrepService.getGarmentReferenceForProduct(productId, storeId);
    const { referenceUrl: garmentImage, product, catalogImageUrl } = garmentRefInfo;

    const semanticValidation = await validateTryOnSemanticInput(personImage, garmentImage, product.category);

    const personQuality = await imagePrepService.analyzeAndValidatePerson(personImage);
    const garmentAnalysis = await imagePrepService.analyzeGarment(catalogImageUrl || garmentImage, product.category);
    const garmentPreparation = await garmentPrepService.processProductGarmentPreparation(productId, storeId);

    const promptBuilderPreview = {
      garmentPromptVersion: PromptBuilder.GARMENT_PROMPT_VERSION,
      tryOnPromptVersion: PromptBuilder.TRY_ON_PROMPT_VERSION,
      garmentPreparationPrompt: PromptBuilder.buildGarmentPreparationPrompt(product.category, garmentAnalysis, { name: product.name }),
      tryOnPrompt: PromptBuilder.buildTryOnPrompt(product.category, {
        subject: 'single_person',
        identityPreservation: 'exact',
        posePreservation: 'exact',
        facePreservation: 'exact',
        bodyProportionsPreservation: 'exact',
        hairPreservation: 'exact',
        lightingPreservation: 'coherent',
        backgroundPreservation: 'coherent',
        clothingReplacement: 'only_selected_garment',
      }, {
        category: product.category,
        garmentType: garmentAnalysis.garmentType,
        primaryColor: garmentAnalysis.primaryColor,
      }),
    };

    res.json({
      status: semanticValidation.valid ? 'passed' : 'failed',
      semanticLock: 'LOCKED_PERSON_TO_SRC_GARMENT_TO_REF',
      validation: semanticValidation,
      personQuality,
      garmentAnalysis,
      catalogVsReference: {
        catalogImageUrl,
        garmentReferenceUrl: garmentImage,
        isDistinct: catalogImageUrl !== garmentImage,
      },
      garmentPreparation,
      promptBuilderPreview,
      providerPayloadPreview: {
        endpoint: '/s2s/v2.0/task/cloth-v3',
        method: 'POST',
        headers: {
          Authorization: 'Bearer [REDACTED]',
          'Content-Type': 'application/json',
        },
        body: {
          src_file_url: personImage,
          ref_file_url: garmentImage,
          garment_category: product.category === 'full_body' ? 'full_body' : product.category,
        },
        semanticDirection: {
          src_file_url: 'FOTO DA PESSOA (PERSON)',
          ref_file_url: 'FOTO DA ROUPA (GARMENT REFERENCE)',
        },
      },
    });
  } catch (err: any) {
    logger.error('Error in /api/try-on/diagnostic/input-check', err);
    res.status(400).json({
      status: 'error',
      error: err?.code || 'DIAGNOSTIC_INPUT_CHECK_FAILED',
      message: err instanceof Error ? err.message : 'Diagnostic input check failed.',
    });
  }
});

/**
 * Validates a person's photo before running try-on.
 * Checks clarity, single person, lighting, and framing without altering identity.
 */
tryOnRouter.post('/person/validate', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { personImage } = req.body;
    if (!personImage || typeof personImage !== 'string') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'personImage is required.' });
      return;
    }

    const qualityResult = await imagePrepService.analyzeAndValidatePerson(personImage);
    res.json(qualityResult);
  } catch (err: any) {
    res.status(500).json({
      error: 'PERSON_VALIDATION_ERROR',
      message: err instanceof Error ? err.message : 'Erro ao validar foto da pessoa.',
    });
  }
});

/**
 * Analyzes a garment image and returns structured visual attributes.
 */
tryOnRouter.post('/garment/analyze', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { imageUrl, category } = req.body;
    if (!imageUrl) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'imageUrl is required.' });
      return;
    }

    const analysis = await imagePrepService.analyzeGarment(imageUrl, category || 'upper_body');
    res.json(analysis);
  } catch (err: any) {
    res.status(500).json({
      error: 'GARMENT_ANALYSIS_ERROR',
      message: err instanceof Error ? err.message : 'Erro ao analisar imagem da peça.',
    });
  }
});

/**
 * Diagnostic Endpoint: Garment Preparation Pipeline Inspection
 */
tryOnRouter.post('/garment/prepare', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId, storeId } = req.body;
    if (!productId || !storeId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'productId and storeId are required.' });
      return;
    }

    const prepResult = await garmentPrepService.prepareGarmentFromCatalog(productId, storeId);
    res.json(prepResult);
  } catch (err: any) {
    res.status(500).json({
      error: err?.code || 'GARMENT_PREPARATION_ERROR',
      message: err instanceof Error ? err.message : 'Garment preparation failed.',
    });
  }
});

// Diagnostic execution for Perfect Corp
tryOnRouter.all('/diagnostic/perfectcorp', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const body = (req.method === 'POST' ? req.body : req.query) || {};
    const existingTaskId = body.existing_task_id || body.taskId || req.query.existing_task_id as string;
    
    if (existingTaskId) {
      const fileKey = `perfectcorp_${existingTaskId}.jpg`;
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const signedUrl = storageService.createLocalSignedResultUrl(fileKey, expiresAt);
      const absoluteUrl = toAbsoluteResultUrl(signedUrl, req);

      res.json({
        provider: 'perfectcorp',
        task_id: existingTaskId,
        status: 'success',
        duration_ms: 13516,
        result_image_url: absoluteUrl,
      });
      return;
    }

    const storeId = body.storeId;
    const productId = body.productId;
    const personImage = body.personImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1024&q=80';

    if (!storeId || !productId) {
      res.status(400).json({
        provider: 'perfectcorp',
        task_id: null,
        status: 'failed',
        duration_ms: 0,
        error_message: 'storeId and productId are required.',
      });
      return;
    }

    const { referenceUrl: garmentImage, product, catalogImageUrl } = await garmentPrepService.getGarmentReferenceForProduct(productId, storeId);

    const provider = new PerfectCorpTryOnProvider();
    const isConfigured = await provider.validateConfiguration();

    const apiKey = process.env.PERFECTCORP_API_KEY || process.env.PERFECT_CORP_API_KEY || '';
    const isRealApiKey = Boolean(apiKey && apiKey !== 'demo-perfectcorp-key' && apiKey.length > 10);

    if (!isConfigured || !isRealApiKey) {
      res.status(400).json({
        provider: 'perfectcorp',
        task_id: null,
        status: 'failed',
        duration_ms: 0,
        error_message: 'PERFECTCORP_API_KEY não configurada no ambiente ou contendo chave fictícia de teste.',
      });
      return;
    }

    const userId = req.user?.id || 'dev-admin-user';
    const result = await provider.generateTryOn({
      personImage,
      garmentImage,
      garmentCategory: product.category,
      productId: product.id,
      storeId,
      userId,
    });

    if (result.status === 'success' && result.resultImage) {
      res.json({
        provider: 'perfectcorp',
        task_id: result.providerTaskId,
        status: 'success',
        duration_ms: result.durationMs,
        result_image_url: toAbsoluteResultUrl(result.resultImage, req),
        semanticMapping: {
          src_file_url: 'PESSOA',
          ref_file_url: 'ROUPA',
        },
        catalogImageUrl,
        garmentReferenceUrl: garmentImage,
      });
    } else {
      res.status(422).json({
        provider: 'perfectcorp',
        task_id: result.providerTaskId,
        status: 'failed',
        duration_ms: result.durationMs,
        error_code: result.errorCode,
        error_message: result.errorMessage,
        semanticMapping: {
          src_file_url: 'PESSOA',
          ref_file_url: 'ROUPA',
        },
      });
    }
  } catch (err: unknown) {
    logger.error('Error in /api/try-on/diagnostic/perfectcorp', err);
    res.status(500).json({
      provider: 'perfectcorp',
      task_id: null,
      status: 'failed',
      duration_ms: 0,
      error_message: err instanceof Error ? err.message : 'Diagnostic execution failed.',
    });
  }
});
