// server/services/TryOnService.ts
import { createClient } from '@supabase/supabase-js';
import { PerfectCorpTryOnProvider } from '../providers/PerfectCorpTryOnProvider';
import { GoogleTryOnProvider } from '../providers/GoogleTryOnProvider';
import {
  TryOnInput,
  TryOnProvider,
  MultiProviderResult,
  StoreProviderMode,
  ProviderResult,
} from '../providers/types';

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
   * Default mode is 'both'.
   */
  async getStoreProviderMode(storeId?: string): Promise<StoreProviderMode> {
    if (!storeId) return 'both';
    const supabase = this.getSupabaseAdmin();
    if (!supabase) return 'both';

    try {
      const { data } = await supabase
        .from('store_ai_settings')
        .select('provider_mode, enabled')
        .eq('store_id', storeId)
        .maybeSingle();

      if (data && data.provider_mode) {
        return data.provider_mode as StoreProviderMode;
      }
    } catch {
      // Fallback
    }
    return 'both';
  }

  /**
   * Main entrypoint to execute Virtual Try-On generation.
   * Enforces store provider mode (perfectcorp, google, or both).
   */
  async executeTryOn(
    input: TryOnInput,
    requestedMode?: StoreProviderMode
  ): Promise<MultiProviderResult> {
    const storeMode = requestedMode || (await this.getStoreProviderMode(input.storeId));

    if (storeMode === 'perfectcorp') {
      const pcRes = await this.perfectCorpProvider.generateTryOn(input);
      const overallStatus = pcRes.status === 'success' ? 'success' : 'failed';
      const genId = await this.saveGenerationHistory(input, storeMode, overallStatus, { perfectcorp: pcRes });

      return {
        mode: 'perfectcorp',
        status: overallStatus,
        results: {
          perfectcorp: pcRes,
        },
        generationId: genId,
      };
    }

    if (storeMode === 'google') {
      const gRes = await this.googleProvider.generateTryOn(input);
      const overallStatus = gRes.status === 'success' ? 'success' : 'failed';
      const genId = await this.saveGenerationHistory(input, storeMode, overallStatus, { google: gRes });

      return {
        mode: 'google',
        status: overallStatus,
        results: {
          google: gRes,
        },
        generationId: genId,
      };
    }

    // MODE = 'both'
    // Execute both providers in parallel for the exact same input
    const [pcSettled, gSettled] = await Promise.allSettled([
      this.perfectCorpProvider.generateTryOn(input),
      this.googleProvider.generateTryOn(input),
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
            errorMessage: pcSettled.reason?.message || 'Falha de execução não tratada.',
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
            errorMessage: gSettled.reason?.message || 'Falha de execução não tratada.',
          };

    const pcSuccess = pcRes.status === 'success';
    const gSuccess = gRes.status === 'success';

    let overallStatus: 'success' | 'partial_success' | 'failed' = 'failed';
    if (pcSuccess && gSuccess) {
      overallStatus = 'success';
    } else if (pcSuccess || gSuccess) {
      overallStatus = 'partial_success'; // A failure in one provider MUST NOT destroy the result of the other!
    } else {
      overallStatus = 'failed';
    }

    const genId = await this.saveGenerationHistory(input, 'both', overallStatus, {
      perfectcorp: pcRes,
      google: gRes,
    });

    return {
      mode: 'both',
      status: overallStatus,
      results: {
        perfectcorp: pcRes,
        google: gRes,
      },
      generationId: genId,
    };
  }

  /**
   * Single provider diagnostic test method
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
          source_photo_path: input.personImage.slice(0, 500),
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
