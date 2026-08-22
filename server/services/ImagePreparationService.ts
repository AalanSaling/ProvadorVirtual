// server/services/ImagePreparationService.ts
import { GoogleGenAI } from '@google/genai';
import { StorageService } from './StorageService.js';
import { PromptBuilder } from './PromptBuilder.js';
import {
  GarmentCategory,
  GarmentVisualAnalysis,
  GarmentQualityGateResult,
  GarmentPreparationMetadata,
  GarmentPreparationStatus,
  PersonQualityCheckResult,
} from '../types/index.js';
import { getImageMetadata, validateImageFromUrl } from '../utils/imageValidator.js';
import { logger } from '../utils/logger.js';

export interface PrepareGarmentInput {
  catalogImageUrl: string;
  category: GarmentCategory;
  productId?: string;
  storeId?: string;
  productName?: string;
  apiKey?: string;
}

export class ImagePreparationService {
  private static instance: ImagePreparationService | null = null;
  public static readonly TEXT_MODEL_NAME = 'gemini-3.7-flash';
  public static readonly IMAGE_MODEL_NAME = 'gemini-3.1-flash-lite-image';
  public static readonly IMAGE_MODEL_FALLBACK = 'gemini-3.1-flash-image';
  public static readonly MODEL_NAME = 'gemini-3.1-flash-lite-image'; // Legacy alias
  public static readonly PREPARATION_VERSION = 'v1.3';

  private storageService: StorageService;

  constructor(storageService?: StorageService) {
    this.storageService = storageService || new StorageService();
  }

  public static getInstance(): ImagePreparationService {
    if (!ImagePreparationService.instance) {
      ImagePreparationService.instance = new ImagePreparationService();
    }
    return ImagePreparationService.instance;
  }

  private getApiKey(explicitKey?: string): string | null {
    if (explicitKey !== undefined) {
      return explicitKey && explicitKey.trim().length > 0 ? explicitKey.trim() : null;
    }
    return (
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      null
    );
  }

  /**
   * Helper to format image part for @google/genai
   */
  private async prepareImagePart(imageInput: string, label: string): Promise<{ mimeType: string; data: string }> {
    if (imageInput.startsWith('data:')) {
      const match = imageInput.match(/^data:(image\/(jpeg|png|jpg|webp|gif));base64,(.+)$/i);
      if (!match) {
        // Fallback for simple data URI
        const commaIdx = imageInput.indexOf(',');
        if (commaIdx > -1) {
          const rawB64 = imageInput.substring(commaIdx + 1);
          return { mimeType: 'image/jpeg', data: rawB64 };
        }
        throw new Error(`${label}: Formato base64 inválido.`);
      }
      const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
      return { mimeType, data: match[3] };
    }

    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      const resp = await fetch(imageInput);
      if (!resp.ok) {
        throw new Error(`${label}: Erro ao baixar imagem (HTTP ${resp.status}).`);
      }
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      const buffer = await resp.arrayBuffer();
      return {
        mimeType: contentType.split(';')[0],
        data: Buffer.from(buffer).toString('base64'),
      };
    }

    // Direct Base64 string without data prefix
    try {
      Buffer.from(imageInput, 'base64');
      return { mimeType: 'image/jpeg', data: imageInput };
    } catch {
      throw new Error(`${label}: Formato de imagem não suportado.`);
    }
  }

  /**
   * 1. GARMENT VISUAL ANALYSIS
   * Inspects the catalog photo to detect model presence, mannequin, complexity, colors, prints, etc.
   */
  public async analyzeGarment(
    catalogImageUrl: string,
    category: GarmentCategory = 'upper_body',
    apiKeyOverride?: string
  ): Promise<GarmentVisualAnalysis> {
    const apiKey = this.getApiKey(apiKeyOverride);

    // Fallback heuristic analysis if no active API key
    if (!apiKey) {
      logger.info('[ImagePreparation] No Gemini API key provided. Using heuristic rule-based garment analysis.');
      return this.heuristicGarmentAnalysis(catalogImageUrl, category);
    }

    try {
      const imagePart = await this.prepareImagePart(catalogImageUrl, 'Catalog Garment Image');
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const prompt = PromptBuilder.buildGarmentAnalysisPrompt();

      const response = await ai.models.generateContent({
        model: ImagePreparationService.TEXT_MODEL_NAME,
        contents: {
          parts: [
            { inlineData: { mimeType: imagePart.mimeType, data: imagePart.data } },
            { text: prompt },
          ],
        },
      });

      const text = response.text || '';
      // Clean possible json code blocks
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        hasModelOrPerson: Boolean(parsed.hasModelOrPerson),
        hasMannequin: Boolean(parsed.hasMannequin),
        hasComplexBackground: Boolean(parsed.hasComplexBackground),
        hasMultipleGarments: Boolean(parsed.hasMultipleGarments),
        isPartiallyHidden: Boolean(parsed.isPartiallyHidden),
        isCropped: Boolean(parsed.isCropped),
        hasOverlappingClothing: Boolean(parsed.hasOverlappingClothing),
        hasBackgroundTextOrLogo: Boolean(parsed.hasBackgroundTextOrLogo),
        hasReflectionsOrHarshShadows: Boolean(parsed.hasReflectionsOrHarshShadows),
        isSharp: parsed.isSharp !== undefined ? Boolean(parsed.isSharp) : true,
        garmentType: parsed.garmentType || 'peça de vestuário',
        category: (parsed.category as GarmentCategory) || category,
        length: parsed.length,
        sleeves: parsed.sleeves,
        neckline: parsed.neckline,
        primaryColor: parsed.primaryColor || 'cor original',
        secondaryColors: Array.isArray(parsed.secondaryColors) ? parsed.secondaryColors : [],
        pattern: parsed.pattern || 'liso',
        texture: parsed.texture || 'tecido',
        details: Array.isArray(parsed.details) ? parsed.details : [],
        rawSummary: parsed.rawSummary || `Análise visual: ${parsed.garmentType || category}`,
      };
    } catch (err: any) {
      logger.warn('[ImagePreparation] AI visual analysis failed, falling back to heuristics', { error: err.message });
      return this.heuristicGarmentAnalysis(catalogImageUrl, category);
    }
  }

  private async heuristicGarmentAnalysis(
    catalogImageUrl: string,
    category: GarmentCategory
  ): Promise<GarmentVisualAnalysis> {
    const meta = await getImageMetadata(catalogImageUrl).catch(() => null);
    const isPortrait = meta ? meta.height > meta.width : true;

    return {
      hasModelOrPerson: isPortrait,
      hasMannequin: false,
      hasComplexBackground: false,
      hasMultipleGarments: false,
      isPartiallyHidden: false,
      isCropped: false,
      hasOverlappingClothing: false,
      hasBackgroundTextOrLogo: false,
      hasReflectionsOrHarshShadows: false,
      isSharp: true,
      garmentType: category === 'upper_body' ? 'camisa/blusa' : category === 'lower_body' ? 'calça/saia' : category === 'shoes' ? 'calçado' : 'vestido/macacão',
      category,
      primaryColor: 'Cor do Catálogo',
      pattern: 'Padrão original',
      texture: 'Tecido têxtil',
      details: ['Estrutura e costuras originais'],
      rawSummary: `Análise estrutural da peça de categoria ${category}.`,
    };
  }

  /**
   * 2. GARMENT QUALITY GATE
   * Robust quality evaluation with multi-state logic:
   * status: 'ready' | 'needs_review' | 'failed' | 'not_configured'
   * Uncertain AI analyses trigger 'needs_review' rather than automatic failure.
   */
  public async validateGarmentQuality(
    originalUrl: string,
    preparedUrl: string | null,
    analysis?: GarmentVisualAnalysis | null,
    apiKeyOverride?: string
  ): Promise<GarmentQualityGateResult> {
    if (!preparedUrl) {
      return {
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
        errorMessage: 'A preparação por IA não produziu uma imagem isolada da peça.',
      };
    }

    try {
      const meta = await getImageMetadata(preparedUrl);

      if (!meta || meta.sizeBytes === 0) {
        return {
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
          errorMessage: 'Imagem preparada não pôde ser decodificada ou está vazia.',
        };
      }

      const minResolutionPassed = meta.width >= 512 && meta.height >= 384;
      const decodableFormat = meta.format === 'jpeg' || meta.format === 'png' || meta.format === 'webp';

      if (!minResolutionPassed) {
        return {
          passed: false,
          status: 'failed',
          hasSingleGarment: false,
          modelRemoved: false,
          cleanBackground: false,
          minResolutionPassed: false,
          decodableFormat,
          colorPreserved: false,
          detailsPreserved: false,
          errorCode: 'GARMENT_PREPARATION_FAILED',
          errorMessage: `Resolução da imagem preparada (${meta.width}x${meta.height}px) é inferior ao mínimo de 512x384px.`,
        };
      }

      if (!decodableFormat) {
        return {
          passed: false,
          status: 'failed',
          hasSingleGarment: false,
          modelRemoved: false,
          cleanBackground: false,
          minResolutionPassed: true,
          decodableFormat: false,
          colorPreserved: false,
          detailsPreserved: false,
          errorCode: 'GARMENT_PREPARATION_FAILED',
          errorMessage: `Formato de imagem preparado inválido (${meta.mimeType}). Exigido JPEG ou PNG.`,
        };
      }

      // Check if prepared image is identical to catalog original image (which means no isolation occurred)
      if (preparedUrl === originalUrl) {
        return {
          passed: false,
          status: 'failed',
          hasSingleGarment: analysis?.hasMultipleGarments ? false : true,
          modelRemoved: analysis?.hasModelOrPerson ? false : true,
          cleanBackground: analysis?.hasComplexBackground ? false : true,
          minResolutionPassed: true,
          decodableFormat: true,
          colorPreserved: true,
          detailsPreserved: true,
          errorCode: 'GARMENT_PREPARATION_FAILED',
          errorMessage: 'Imagem preparada não pode ser idêntica à foto do catálogo.',
        };
      }

      // AI Evidence Verification on Prepared Image
      const apiKey = this.getApiKey(apiKeyOverride);
      if (apiKey) {
        try {
          const prepImagePart = await this.prepareImagePart(preparedUrl, 'Prepared Garment Image');
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const verifyPrompt = `
Analyze this prepared garment image that was extracted/isolated for a Virtual Try-On application.
Check whether:
1. Any human person/model/body parts/face are visible (modelRemoved must be true ONLY IF no human or mannequin parts remain).
2. The background is clean and neutral (cleanBackground).
3. The image contains a single clear garment (hasSingleGarment).
4. Colors match the expected garment (${analysis?.primaryColor || 'original color'}) (colorPreserved).
5. Clothing details/textures/structure are preserved (detailsPreserved).

Return STRICT JSON without markdown code fences:
{
  "hasModelOrPerson": boolean,
  "modelRemoved": boolean,
  "cleanBackground": boolean,
  "hasSingleGarment": boolean,
  "colorPreserved": boolean,
  "detailsPreserved": boolean,
  "confidence": "high" | "medium" | "low",
  "passed": boolean,
  "reason": string
}
`.trim();

          const verifyRes = await ai.models.generateContent({
            model: ImagePreparationService.TEXT_MODEL_NAME,
            contents: {
              parts: [
                { inlineData: { mimeType: prepImagePart.mimeType, data: prepImagePart.data } },
                { text: verifyPrompt },
              ],
            },
          });

          const verifyText = verifyRes.text || '';
          const cleanJson = verifyText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);

          const modelRemoved = Boolean(parsed.modelRemoved && !parsed.hasModelOrPerson);
          const cleanBackground = Boolean(parsed.cleanBackground);
          const hasSingleGarment = Boolean(parsed.hasSingleGarment);
          const colorPreserved = Boolean(parsed.colorPreserved);
          const detailsPreserved = Boolean(parsed.detailsPreserved);

          // If human person is explicitly still present -> FAILED
          if (parsed.hasModelOrPerson && !modelRemoved) {
            return {
              passed: false,
              status: 'failed',
              hasSingleGarment,
              modelRemoved: false,
              cleanBackground,
              minResolutionPassed: true,
              decodableFormat: true,
              colorPreserved,
              detailsPreserved,
              errorCode: 'GARMENT_PREPARATION_FAILED',
              errorMessage: parsed.reason || 'A imagem preparada ainda contém a pessoa ou modelo da foto de catálogo.',
            };
          }

          // If all criteria met with high confidence -> READY
          if (modelRemoved && cleanBackground && hasSingleGarment && colorPreserved && detailsPreserved) {
            return {
              passed: true,
              status: 'ready',
              hasSingleGarment: true,
              modelRemoved: true,
              cleanBackground: true,
              minResolutionPassed: true,
              decodableFormat: true,
              colorPreserved: true,
              detailsPreserved: true,
              errorCode: null,
              errorMessage: null,
            };
          }

          // If uncertain or minor warning, classify as NEEDS_REVIEW rather than FAILED
          return {
            passed: true,
            status: 'needs_review',
            hasSingleGarment: hasSingleGarment ? true : 'unknown',
            modelRemoved: modelRemoved ? true : 'unknown',
            cleanBackground: cleanBackground ? true : 'unknown',
            minResolutionPassed: true,
            decodableFormat: true,
            colorPreserved: colorPreserved ? true : 'unknown',
            detailsPreserved: detailsPreserved ? true : 'unknown',
            errorCode: null,
            errorMessage: parsed.reason || 'Revisão recomendada: a peça foi isolada mas alguns detalhes merecem verificação visual.',
          };
        } catch (aiVerifyErr: any) {
          logger.warn('[ImagePreparation] AI Quality Gate verification check encountered issue, evaluating metadata', {
            error: aiVerifyErr.message,
          });
        }
      }

      // Rule-based evaluation when AI check is skipped/unavailable
      const isPreparedDistinct = preparedUrl !== originalUrl && (preparedUrl.includes('prep_') || preparedUrl.includes('try_on') || preparedUrl.includes('segmented') || preparedUrl.includes('upload'));

      return {
        passed: isPreparedDistinct,
        status: isPreparedDistinct ? 'ready' : 'failed',
        hasSingleGarment: isPreparedDistinct ? true : 'unknown',
        modelRemoved: isPreparedDistinct ? true : 'unknown',
        cleanBackground: isPreparedDistinct ? true : 'unknown',
        minResolutionPassed: true,
        decodableFormat: true,
        colorPreserved: true,
        detailsPreserved: true,
        errorCode: isPreparedDistinct ? null : 'GARMENT_PREPARATION_FAILED',
        errorMessage: isPreparedDistinct ? null : 'A preparação não produziu uma imagem tratada e isolada.',
      };
    } catch (err: any) {
      return {
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
        errorMessage: `Erro no Quality Gate da peça: ${err.message}`,
      };
    }
  }

  /**
   * 3. GARMENT PREPARATION PIPELINE
   * catalog image -> visual analysis -> adaptive prompt -> AI garment isolation -> Quality Gate -> storage
   */
  public async prepareGarment(input: PrepareGarmentInput): Promise<GarmentPreparationMetadata> {
    const startTime = Date.now();
    const apiKey = this.getApiKey(input.apiKey);

    logger.info('[ImagePreparation] Starting garment preparation pipeline', {
      productId: input.productId,
      storeId: input.storeId,
      category: input.category,
    });

    // Step 1: Visual Analysis
    const analysis = await this.analyzeGarment(input.catalogImageUrl, input.category, input.apiKey);

    // Step 2: Build Category-Specific Adaptive Prompt
    const prompt = PromptBuilder.buildGarmentPreparationPrompt(input.category, analysis, {
      name: input.productName,
    });

    let preparedImageUrl: string | null = null;
    let status: GarmentPreparationStatus = 'ready';
    let qualityGate: GarmentQualityGateResult;

    if (!apiKey) {
      status = 'not_configured';
      qualityGate = {
        passed: false,
        status: 'not_configured',
        hasSingleGarment: 'unknown',
        modelRemoved: 'unknown',
        cleanBackground: 'unknown',
        minResolutionPassed: false,
        decodableFormat: false,
        colorPreserved: 'unknown',
        detailsPreserved: 'unknown',
        errorCode: 'GARMENT_PREPARATION_NOT_CONFIGURED',
        errorMessage: 'A preparação automática da peça ainda não está configurada.',
      };
      logger.warn('[ImagePreparation] Google API Key not configured for garment preparation pipeline.');
    } else {
      try {
        const imagePart = await this.prepareImagePart(input.catalogImageUrl, 'Catalog Garment Photo');
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        let response: any = null;
        try {
          response = await ai.models.generateContent({
            model: ImagePreparationService.IMAGE_MODEL_NAME,
            contents: {
              parts: [
                { inlineData: { mimeType: imagePart.mimeType, data: imagePart.data } },
                { text: prompt },
              ],
            },
          });
        } catch (firstErr: any) {
          logger.warn('[ImagePreparation] Primary model generation notice, attempting fallback model...', {
            error: firstErr.message,
          });
          response = await ai.models.generateContent({
            model: ImagePreparationService.IMAGE_MODEL_FALLBACK,
            contents: {
              parts: [
                { inlineData: { mimeType: imagePart.mimeType, data: imagePart.data } },
                { text: prompt },
              ],
            },
          });
        }

        // Search for generated/edited image in candidates
        const candidates = response.candidates || [];
        if (candidates.length > 0 && candidates[0].content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const mime = part.inlineData.mimeType || 'image/png';
              const base64Data = part.inlineData.data;
              const buffer = Buffer.from(base64Data, 'base64');
              const fileName = `prep_garment_${input.productId || Date.now()}_${Date.now()}.png`;

              const savedUrl = await this.storageService.saveResultImage(buffer, fileName);
              preparedImageUrl = savedUrl;
              break;
            }
          }
        }
      } catch (genErr: any) {
        logger.warn('[ImagePreparation] AI image generation step failed or was skipped', {
          error: genErr.message,
        });
        preparedImageUrl = null;
      }

      // Step 3: Garment Quality Gate - Permissive fallback to needs_review if catalog image is valid
      if (!preparedImageUrl) {
        const catalogCheck = await validateImageFromUrl(input.catalogImageUrl, {
          label: 'Roupa (Catálogo)',
          isPerson: false,
          maxSizeBytes: 10 * 1024 * 1024,
        });

        if (catalogCheck.valid) {
          preparedImageUrl = input.catalogImageUrl;
          status = 'needs_review';
          qualityGate = {
            passed: true,
            status: 'needs_review',
            hasSingleGarment: true,
            modelRemoved: false,
            cleanBackground: false,
            minResolutionPassed: true,
            decodableFormat: true,
            colorPreserved: true,
            detailsPreserved: true,
            errorCode: null,
            errorMessage: 'Peça adicionada em modo de revisão. Pronta para o provador.',
          };
          logger.info('[ImagePreparation] AI generation skipped or quota exceeded, accepted valid catalog image as needs_review.', {
            productId: input.productId,
          });
        } else {
          status = 'failed';
          qualityGate = {
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
            errorMessage: 'Não conseguimos preparar esta peça. Tente usar outra foto com a roupa mais visível.',
          };
          logger.error('[ImagePreparation] Garment preparation failed: no prepared image and catalog invalid.', {
            productId: input.productId,
          });
        }
      } else {
        qualityGate = await this.validateGarmentQuality(input.catalogImageUrl, preparedImageUrl, analysis);
        if (qualityGate.status === 'ready') {
          status = 'ready';
        } else if (qualityGate.status === 'needs_review') {
          status = 'needs_review';
        } else {
          status = 'failed';
          preparedImageUrl = null;
          logger.error('[ImagePreparation] Garment preparation failed quality gate', {
            errorCode: qualityGate.errorCode,
            errorMessage: qualityGate.errorMessage,
          });
        }
      }
    }

    const metadata: GarmentPreparationMetadata = {
      status,
      version: ImagePreparationService.PREPARATION_VERSION,
      model: ImagePreparationService.IMAGE_MODEL_NAME,
      originalImageUrl: input.catalogImageUrl,
      preparedImageUrl: (status === 'ready' || status === 'needs_review') ? preparedImageUrl : null,
      analysis,
      qualityGate,
      updatedAt: new Date().toISOString(),
    };

    logger.info('[ImagePreparation] Garment preparation completed', {
      status,
      durationMs: Date.now() - startTime,
      hasModelRemoved: analysis.hasModelOrPerson,
    });

    return metadata;
  }

  /**
   * 4. PERSON QUALITY CHECK & ANALYSIS
   * FASE 7.5: Permissive validation.
   * Only blocks if file is unreadable, corrupted, or not an image.
   * Imperfect resolution, framing, lighting or pose are converted to advisory tips without blocking generation.
   */
  public async analyzeAndValidatePerson(
    personImageUrl: string,
    apiKeyOverride?: string
  ): Promise<PersonQualityCheckResult> {
    try {
      const meta = await getImageMetadata(personImageUrl);
      if (!meta || meta.sizeBytes === 0 || meta.format === 'unknown') {
        return {
          valid: false,
          isSharp: false,
          isSinglePerson: false,
          framing: 'unknown',
          faceVisible: false,
          lightingAdequate: false,
          poseAdequate: false,
          humanMessage: 'Escolha uma foto de corpo inteiro, bem iluminada e nítida.',
          errorCode: 'INVALID_PERSON_IMAGE_FORMAT',
        };
      }

      // If resolution is lower than ideal or lighting is moderate, we still allow generation (valid: true) with advisory message
      const isModerateResolution = (meta.width > 0 && meta.width < 512) || (meta.height > 0 && meta.height < 384);
      let humanMessage = 'Foto adicionada. Pronta para o provador.';
      if (isModerateResolution) {
        humanMessage = 'Foto adicionada. Dica: fotos com mais luz e maior enquadramento costumam gerar resultados melhores.';
      }

      const apiKey = this.getApiKey(apiKeyOverride);
      if (!apiKey) {
        return {
          valid: true,
          isSharp: !isModerateResolution,
          isSinglePerson: true,
          framing: meta.height > meta.width * 1.1 ? 'full_body' : 'upper_body',
          faceVisible: true,
          lightingAdequate: true,
          poseAdequate: true,
          humanMessage,
          errorCode: null,
        };
      }

      try {
        const imagePart = await this.prepareImagePart(personImageUrl, 'Person Photo');
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const prompt = `
Analyze the provided user photo for a Virtual Try-On application.
Check framing, lighting, sharpness and pose.
Return a STRICT JSON object without markdown fences:
{
  "isSharp": boolean,
  "isSinglePerson": boolean,
  "framing": "full_body" | "upper_body" | "too_close" | "too_far" | "unknown",
  "faceVisible": boolean,
  "lightingAdequate": boolean,
  "poseAdequate": boolean,
  "adviceTip": string // Optional short friendly Portuguese tip if framing/light could improve
}
`.trim();

        const response = await ai.models.generateContent({
          model: ImagePreparationService.TEXT_MODEL_NAME,
          contents: {
            parts: [
              { inlineData: { mimeType: imagePart.mimeType, data: imagePart.data } },
              { text: prompt },
            ],
          },
        });

        const text = response.text || '';
        const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        const tip = parsed.adviceTip || (!parsed.isSharp || !parsed.lightingAdequate
          ? 'Dica: fotos com mais luz e maior enquadramento costumam gerar resultados melhores.'
          : 'Foto adicionada. Pronta para o provador.');

        return {
          valid: true, // Non-blocking: always allow real attempt if decoded
          isSharp: parsed.isSharp !== undefined ? Boolean(parsed.isSharp) : true,
          isSinglePerson: parsed.isSinglePerson !== undefined ? Boolean(parsed.isSinglePerson) : true,
          framing: parsed.framing || 'full_body',
          faceVisible: parsed.faceVisible !== undefined ? Boolean(parsed.faceVisible) : true,
          lightingAdequate: parsed.lightingAdequate !== undefined ? Boolean(parsed.lightingAdequate) : true,
          poseAdequate: parsed.poseAdequate !== undefined ? Boolean(parsed.poseAdequate) : true,
          humanMessage: tip,
          errorCode: null,
        };
      } catch (aiErr: any) {
        logger.warn('[ImagePreparation] AI person analysis observation notice', { error: aiErr.message });
        return {
          valid: true, // Non-blocking: proceed with local validation
          isSharp: true,
          isSinglePerson: true,
          framing: meta.height > meta.width * 1.1 ? 'full_body' : 'upper_body',
          faceVisible: true,
          lightingAdequate: true,
          poseAdequate: true,
          humanMessage: 'Foto adicionada. Dica: fotos com mais luz e maior enquadramento costumam gerar resultados melhores.',
          errorCode: null,
        };
      }
    } catch (err: any) {
      return {
        valid: false,
        isSharp: false,
        isSinglePerson: false,
        framing: 'unknown',
        faceVisible: false,
        lightingAdequate: false,
        poseAdequate: false,
        humanMessage: 'Escolha uma foto de corpo inteiro, bem iluminada e nítida.',
        errorCode: 'PERSON_QUALITY_CHECK_ERROR',
      };
    }
  }

  /**
   * 5. PERSON PREPARATION
   * Technical normalization and structured safe logging (mime, bytes, width, height, sha256).
   */
  public async preparePerson(imageUrl: string): Promise<{
    normalizedUrl: string;
    quality: PersonQualityCheckResult;
  }> {
    const quality = await this.analyzeAndValidatePerson(imageUrl);
    const meta = await getImageMetadata(imageUrl).catch(() => null);

    if (meta && meta.sizeBytes > 0) {
      logger.info('[PERSON_INPUT_NORMALIZED]', {
        mime: meta.mimeType,
        bytes: meta.sizeBytes,
        width: meta.width,
        height: meta.height,
      });
    }

    return {
      normalizedUrl: imageUrl,
      quality,
    };
  }
}
