// server/services/TryOnService.ts
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { StorageService } from './StorageService.js';
import { supabaseAdmin } from '../middleware/authMiddleware.js';
import { MultiProviderTryOnResponse, TryOnInput, TryOnResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class TryOnService {
  private registry: ProviderRegistry;
  private storageService: StorageService;

  constructor() {
    this.registry = ProviderRegistry.getInstance();
    this.storageService = new StorageService();
  }

  /**
   * Retrieves configured providers for a given store.
   * Throws AI_PROVIDER_NOT_CONFIGURED if no configuration exists or enabled_providers is empty.
   */
  public async getStoreEnabledProviders(storeId: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from('store_provider_configs')
      .select('enabled_providers')
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching store provider config', error, { storeId });
    }

    const enabled = data?.enabled_providers as string[] | undefined;

    if (!enabled || !Array.isArray(enabled) || enabled.length === 0) {
      const err = new Error('AI_PROVIDER_NOT_CONFIGURED: No AI providers have been configured for this store.');
      (err as unknown as Record<string, string>).code = 'AI_PROVIDER_NOT_CONFIGURED';
      throw err;
    }

    return enabled;
  }

  /**
   * Executes Virtual Try-On across N selected providers concurrently using Promise.allSettled.
   * Does NOT accept 'both' as a special keyword — accepts selectedProviders: string[].
   */
  public async executeMultiProviderTryOn(
    input: TryOnInput,
    selectedProviders: string[],
    inputStoragePathToCleanup?: string
  ): Promise<MultiProviderTryOnResponse> {
    const startTime = Date.now();

    if (!selectedProviders || selectedProviders.length === 0) {
      const err = new Error('AI_PROVIDER_NOT_CONFIGURED: No providers selected for generation.');
      (err as unknown as Record<string, string>).code = 'AI_PROVIDER_NOT_CONFIGURED';
      throw err;
    }

    logger.info(`Starting Virtual Try-On execution for store ${input.storeId}`, {
      selectedProviders,
      category: input.garmentCategory,
      userId: input.userId,
    });

    try {
      // 1. Resolve provider instances from ProviderRegistry
      const providerInstances = selectedProviders.map(id => {
        try {
          return this.registry.get(id);
        } catch (e) {
          throw new Error(`PROVIDER_NOT_AVAILABLE: Provider '${id}' is not available or registered.`);
        }
      });

      // 2. Execute all providers concurrently using Promise.allSettled
      const executionPromises = providerInstances.map(provider =>
        provider.generateTryOn(input)
      );

      const settledResults = await Promise.allSettled(executionPromises);

      // 3. Process individual provider results
      const results: TryOnResult[] = settledResults.map((settled, index) => {
        const providerId = selectedProviders[index];
        if (settled.status === 'fulfilled') {
          return settled.value;
        } else {
          logger.error(`Provider execution thrown exception: ${providerId}`, settled.reason);
          return {
            provider: providerId,
            status: 'failed',
            resultImage: null,
            providerTaskId: null,
            errorCode: 'PROVIDER_EXECUTION_EXCEPTION',
            errorMessage: settled.reason?.message || 'Unexpected provider execution error.',
            durationMs: Date.now() - startTime,
          };
        }
      });

      // 4. Calculate overall status
      const successCount = results.filter(r => r.status === 'success' && r.resultImage !== null).length;
      let overallStatus: 'success' | 'partial_success' | 'failed';

      if (successCount === results.length) {
        overallStatus = 'success';
      } else if (successCount > 0) {
        overallStatus = 'partial_success';
      } else {
        overallStatus = 'failed';
      }

      const response: MultiProviderTryOnResponse = {
        overallStatus,
        selectedProviders,
        results,
        storeId: input.storeId,
        timestamp: new Date().toISOString(),
      };

      // 5. Persist audit generation record in database
      await this.recordGenerationAudit(input, selectedProviders, overallStatus, results);

      return response;

    } finally {
      // 6. MANDATORY PRIVACY CLEANUP: Delete temporary person photo
      if (inputStoragePathToCleanup) {
        await this.storageService.cleanupTemporaryInput(inputStoragePathToCleanup);
      }
    }
  }

  private async recordGenerationAudit(
    input: TryOnInput,
    selectedProviders: string[],
    overallStatus: string,
    results: TryOnResult[]
  ): Promise<void> {
    try {
      await supabaseAdmin.from('try_on_generations').insert({
        user_id: input.userId,
        store_id: input.storeId,
        product_id: input.productId || null,
        selected_providers: selectedProviders,
        overall_status: overallStatus,
        results_payload: results,
      });
    } catch (err) {
      logger.error('Failed to log try_on_generations audit record', err);
    }
  }
}
