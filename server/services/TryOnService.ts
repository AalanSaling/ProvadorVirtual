// server/services/TryOnService.ts
import { createClient } from '@supabase/supabase-js';
import { PerfectCorpTryOnProvider } from '../providers/PerfectCorpTryOnProvider';
import { GoogleTryOnProvider } from '../providers/GoogleTryOnProvider';
import {
  TryOnInput,
  MultiProviderResult,
  StoreProviderMode,
  ProviderResult,
} from '../providers/types';
import {
  uploadPersonImageAndGetSignedUrl,
  prepareGarmentImageForProvider,
  saveResultToPrivateStorage,
  cleanupTempInputPhoto,
} from './storageHelper';

export class TryOnService {
  private perfectCorpProvider: PerfectCorpTryOnProvider;
  private googleProvider: GoogleTryOnProvider;

  constructor() {
    this.perfectCorpProvider = new PerfectCorpTryOnProvider();
    this.googleProvider = new GoogleTryOnProvider();
  }

  private getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (!url || !key) return null;
    return createClient(url, key);
  }

  /**
   * Fetches store AI provider settings from database.
   * Throws or returns null if not configured (No automatic 'both' fallback!).
   */
  async getStoreProviderMode(storeId?: string): Promise<StoreProviderMode | null> {
    if (!storeId) return null;
    const supabase = this.getSupabaseAdmin();
    if (!supabase) return null;

    try {
      const { data } = await supabase
        .from('store_ai_settings')
        .select('provider_mode, enabled')
        .eq('store_id', storeId)
        .maybeSingle();

      if (data && data.enabled && data.provider_mode) {
        return data.provider_mode as StoreProviderMode;
      }
    } catch {
      // Return null if query fails or unconfigured
    }
    return null;
  }

  /**
   * Main entrypoint to execute Virtual Try-On generation.
   */
  async executeTryOn(
    input: TryOnInput,
    requestedMode?: StoreProviderMode
  ): Promise<MultiProviderResult> {
    const startTime = Date.now();
    const reqId = `tryOn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const storeMode = requestedMode || (await this.getStoreProviderMode(input.storeId));

    if (!storeMode) {
      throw new Error('AI_PROVIDER_NOT_CONFIGURED: O provador virtual não está configurado ou ativado para esta loja.');
    }

    // 1. Prepare Person Image via Storage Pipeline (Signed URL)
    let personPrepared: { signedUrl: string; storagePath: string };
    let garmentPrepared: { url: string; storagePath: string };

    try {
      personPrepared = await uploadPersonImageAndGetSignedUrl(
        input.personImage,
        input.userId || 'anon'
      );
    } catch (err: any) {
      return {
        mode: storeMode,
        status: 'failed',
        results: {
          perfectcorp: {
            provider: 'perfectcorp',
            status: 'failed',
            image: null,
            taskId: null,
            latencyMs: Date.now() - startTime,
            errorCode: 'PERFECTCORP_INVALID_IMAGE',
            errorMessage: err.message || 'Erro ao processar imagem da pessoa.',
          },
        },
      };
    }

    // 2. Prepare Garment Image
    try {
      garmentPrepared = await prepareGarmentImageForProvider(
        input.garmentImage,
        input.productId
      );
    } catch (err: any) {
      if (personPrepared.storagePath) {
        await cleanupTempInputPhoto(personPrepared.storagePath);
      }
      return {
        mode: storeMode,
        status: 'failed',
        results: {
          perfectcorp: {
            provider: 'perfectcorp',
            status: 'failed',
            image: null,
            taskId: null,
            latencyMs: Date.now() - startTime,
            errorCode: 'PERFECTCORP_INVALID_IMAGE',
            errorMessage: err.message || 'Erro ao processar imagem da roupa.',
          },
        },
      };
    }

    const providerInput: TryOnInput = {
      ...input,
      personImage: personPrepared.signedUrl,
      garmentImage: garmentPrepared.url,
    };

    let finalResult: MultiProviderResult;

    try {
      if (storeMode === 'perfectcorp') {
        const pcRes = await this.perfectCorpProvider.generateTryOn(providerInput);

        if (pcRes.status === 'success' && pcRes.image) {
          const savedResult = await saveResultToPrivateStorage(pcRes.image, input.userId || 'anon');
          pcRes.image = savedResult.signedUrl;
        }

        const overallStatus = pcRes.status === 'success' ? 'success' : 'failed';
        const genId = await this.saveGenerationHistory(input, storeMode, overallStatus, { perfectcorp: pcRes });

        finalResult = {
          mode: 'perfectcorp',
          status: overallStatus,
          results: { perfectcorp: pcRes },
          generationId: genId,
        };
      } else if (storeMode === 'google') {
        const gRes = await this.googleProvider.generateTryOn(providerInput);

        if (gRes.status === 'success' && gRes.image) {
          const savedResult = await saveResultToPrivateStorage(gRes.image, input.userId || 'anon');
          gRes.image = savedResult.signedUrl;
        }

        const overallStatus = gRes.status === 'success' ? 'success' : 'failed';
        const genId = await this.saveGenerationHistory(input, storeMode, overallStatus, { google: gRes });

        finalResult = {
          mode: 'google',
          status: overallStatus,
          results: { google: gRes },
          generationId: genId,
        };
      } else {
        // MODE = 'both' (Execute both in parallel)
        const [pcSettled, gSettled] = await Promise.allSettled([
          this.perfectCorpProvider.generateTryOn(providerInput),
          this.googleProvider.generateTryOn(providerInput),
        ]);

        const pcRes: ProviderResult =
          pcSettled.status === 'fulfilled'
            ? pcSettled.value
            : {
                provider: 'perfectcorp',
                status: 'error',
                image: null,
                taskId: null,
                latencyMs: 0,
                errorCode: 'PERFECTCORP_PROVIDER_ERROR',
                errorMessage: pcSettled.reason?.message || 'Falha na execução da Perfect Corp.',
              };

        const gRes: ProviderResult =
          gSettled.status === 'fulfilled'
            ? gSettled.value
            : {
                provider: 'google',
                status: 'error',
                image: null,
                taskId: null,
                latencyMs: 0,
                errorCode: 'GOOGLE_PROVIDER_ERROR',
                errorMessage: gSettled.reason?.message || 'Falha na execução do Google Gemini.',
              };

        if (pcRes.status === 'success' && pcRes.image) {
          const savedResult = await saveResultToPrivateStorage(pcRes.image, input.userId || 'anon');
          pcRes.image = savedResult.signedUrl;
        }

        if (gRes.status === 'success' && gRes.image) {
          const savedResult = await saveResultToPrivateStorage(gRes.image, input.userId || 'anon');
          gRes.image = savedResult.signedUrl;
        }

        const pcSuccess = pcRes.status === 'success';
        const gSuccess = gRes.status === 'success';

        let overallStatus: 'success' | 'partial_success' | 'failed' = 'failed';
        if (pcSuccess && gSuccess) {
          overallStatus = 'success';
        } else if (pcSuccess || gSuccess) {
          overallStatus = 'partial_success'; // Do not ruin valid result if one provider fails
        } else {
          overallStatus = 'failed';
        }

        const genId = await this.saveGenerationHistory(input, 'both', overallStatus, {
          perfectcorp: pcRes,
          google: gRes,
        });

        finalResult = {
          mode: 'both',
          status: overallStatus,
          results: {
            perfectcorp: pcRes,
            google: gRes,
          },
          generationId: genId,
        };
      }
    } finally {
      // Privacy Cleanup: Immediately delete temporary input person photo from private bucket
      if (personPrepared.storagePath) {
        await cleanupTempInputPhoto(personPrepared.storagePath);
      }
    }

    // Structured Log Output (Requirement 19: NO API keys, JWTs or base64 images logged!)
    const durationMs = Date.now() - startTime;
    const errCode =
      finalResult.results.perfectcorp?.errorCode ||
      finalResult.results.google?.errorCode ||
      'NONE';

    console.log(
      `[TRY-ON LOG] req_id=${reqId} user_id=${input.userId || 'anon'} store_id=${input.storeId || 'none'} product_id=${input.productId || 'none'} provider=${storeMode} duration_ms=${durationMs} status=${finalResult.status} error_code=${errCode}`
    );

    return finalResult;
  }

  /**
   * Diagnostic test for single provider
   */
  async testProvider(providerName: 'perfectcorp' | 'google', input: TryOnInput): Promise<ProviderResult> {
    if (providerName === 'perfectcorp') {
      return this.perfectCorpProvider.generateTryOn(input);
    } else {
      return this.googleProvider.generateTryOn(input);
    }
  }

  private async saveGenerationHistory(
    input: TryOnInput,
    mode: StoreProviderMode,
    overallStatus: string,
    results: { perfectcorp?: ProviderResult; google?: ProviderResult }
  ): Promise<string | undefined> {
    const supabase = this.getSupabaseAdmin();
    if (!supabase || !input.storeId) return undefined;

    try {
      const mainResultPhoto =
        results.perfectcorp?.image || results.google?.image || null;

      const mainError =
        results.perfectcorp?.errorMessage || results.google?.errorMessage || null;

      const mainErrorCode =
        results.perfectcorp?.errorCode || results.google?.errorCode || null;

      const { data } = await supabase
        .from('try_on_generations')
        .insert({
          user_id: input.userId || null,
          store_id: input.storeId,
          product_id: input.productId || null,
          provider: mode,
          status: overallStatus,
          result_photo_path: mainResultPhoto,
          error_code: mainErrorCode,
          error_message: mainError,
          completed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      return data?.id;
    } catch {
      return undefined;
    }
  }
}
