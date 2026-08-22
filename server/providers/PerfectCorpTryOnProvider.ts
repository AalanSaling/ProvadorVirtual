// server/providers/PerfectCorpTryOnProvider.ts
import { ITryOnProvider } from './interfaces/ITryOnProvider.js';
import { ProviderCapabilities, TryOnInput, TryOnResult, GarmentCategory, ExecutionContext } from '../types/index.js';
import { StorageService } from '../services/StorageService.js';
import { validateTryOnSemanticInput } from '../utils/imageValidator.js';
import { logger } from '../utils/logger.js';

export class PerfectCorpTryOnProvider implements ITryOnProvider {
  readonly id = 'perfectcorp';
  readonly name = 'Perfect Corp AI Clothes';
  readonly capabilities: ProviderCapabilities = {
    upperBody: true,
    lowerBody: true,
    fullBody: true,
    shoes: true,
  };

  private storageService: StorageService;

  constructor(storageService?: StorageService) {
    this.storageService = storageService || new StorageService();
  }

  private getApiKey(): string | null {
    const key = process.env.PERFECTCORP_API_KEY || process.env.PERFECT_CORP_API_KEY;
    return key && key.trim() ? key.trim() : null;
  }

  private getApiHost(): string | null {
    const host = process.env.PERFECTCORP_API_HOST || 'https://yce-api-01.makeupar.com';
    return host.trim().replace(/\/+$/, '');
  }

  public async validateConfiguration(context?: Partial<ExecutionContext>): Promise<boolean> {
    const apiKey = context?.storeApiKey || this.getApiKey();
    const apiHost = this.getApiHost();
    return Boolean(apiKey && apiHost);
  }

  private mapGarmentCategory(category: GarmentCategory): string {
    switch (category) {
      case 'upper_body':
        return 'upper_body';
      case 'lower_body':
        return 'lower_body';
      case 'full_body':
        return 'full_body';
      case 'shoes':
        return 'shoes';
      default:
        return 'auto';
    }
  }

  public async generateTryOn(input: TryOnInput, context?: ExecutionContext): Promise<TryOnResult> {
    const startTime = Date.now();
    const requestId = `pc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Resolve per-store dynamic credential from ExecutionContext (with server dev fallback if available)
    const apiKey = context?.storeApiKey || this.getApiKey();
    const apiHost = this.getApiHost();

    if (!apiKey || !apiHost) {
      const missingMsg = !apiKey
        ? `STORE_PROVIDER_CREDENTIAL_NOT_CONFIGURED: Chave de API do Perfect Corp não configurada para a loja ${context?.storeId || input.storeId}.`
        : 'PERFECTCORP_API_HOST is missing in server environment.';

      logger.error(`[PerfectCorp] Auth configuration missing: ${missingMsg}`, { requestId });

      return {
        provider: this.id,
        status: 'failed',
        resultImage: null,
        providerTaskId: null,
        errorCode: 'PERFECTCORP_AUTH_ERROR',
        errorMessage: missingMsg,
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Validate URLs (personImage and garmentImage must be HTTP/HTTPS URLs)
    if (!input.personImage || (!input.personImage.startsWith('http://') && !input.personImage.startsWith('https://'))) {
      logger.error('[PerfectCorp] personImage is not an accessible HTTP(S) URL', { requestId });
      return {
        provider: this.id,
        status: 'failed',
        resultImage: null,
        providerTaskId: null,
        errorCode: 'PERFECTCORP_INVALID_IMAGE',
        errorMessage: 'personImage (src_file_url) must be a valid HTTP(S) URL.',
        durationMs: Date.now() - startTime,
      };
    }

    if (!input.garmentImage || (!input.garmentImage.startsWith('http://') && !input.garmentImage.startsWith('https://'))) {
      logger.error('[PerfectCorp] garmentImage is not an accessible HTTP(S) URL', { requestId });
      return {
        provider: this.id,
        status: 'failed',
        resultImage: null,
        providerTaskId: null,
        errorCode: 'PERFECTCORP_INVALID_IMAGE',
        errorMessage: 'garmentImage (ref_file_url) must be a valid HTTP(S) URL.',
        durationMs: Date.now() - startTime,
      };
    }

    // 2b. Execute Semantic Input Validation (Format, dimensions, size, hashes, inequality)
    const semanticValidation = await validateTryOnSemanticInput(
      input.personImage,
      input.garmentImage,
      input.garmentCategory
    );

    if (!semanticValidation.valid) {
      logger.error(`[PerfectCorp] Semantic input validation failed: ${semanticValidation.errorMessage}`, {
        requestId,
        errorCode: semanticValidation.errorCode,
      });

      return {
        provider: this.id,
        status: 'failed',
        resultImage: null,
        providerTaskId: null,
        errorCode: semanticValidation.errorCode === 'SEMANTIC_COLLISION_PERSON_EQUALS_GARMENT'
          ? 'PERFECTCORP_SEMANTIC_COLLISION'
          : 'PERFECTCORP_INVALID_IMAGE',
        errorMessage: semanticValidation.errorMessage || 'Falha na validação semântica das imagens de entrada.',
        durationMs: Date.now() - startTime,
      };
    }

    const taskEndpoint = `${apiHost}/s2s/v2.0/task/cloth-v3`;
    const garmentCategory = this.mapGarmentCategory(input.garmentCategory);

    logger.info('[PerfectCorp] Creating VTON task with strictly mapped semantic inputs and store credential', {
      requestId,
      storeId: context?.storeId || input.storeId,
      category: garmentCategory,
      srcFileRole: 'PESSOA',
      refFileRole: 'ROUPA',
    });

    try {
      // 3. Create Task call to Perfect Corp API with per-store dynamic bearer token
      // src_file_url = personImage (PESSOA)
      // ref_file_url = garmentImage (ROUPA)
      // NEVER INVERT!
      const createResponse = await fetch(taskEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          src_file_url: input.personImage,
          ref_file_url: input.garmentImage,
          garment_category: garmentCategory,
        }),
      });

      const httpStatus = createResponse.status;

      if (httpStatus === 401 || httpStatus === 403) {
        logger.error('[PerfectCorp] Authentication failed (401/403)', { requestId, httpStatus });
        return {
          provider: this.id,
          status: 'failed',
          resultImage: null,
          providerTaskId: null,
          errorCode: 'PERFECTCORP_AUTH_ERROR',
          errorMessage: `Perfect Corp API authentication failed (HTTP ${httpStatus}). Verifique a credencial da loja.`,
          durationMs: Date.now() - startTime,
        };
      }

      if (httpStatus === 429) {
        logger.error('[PerfectCorp] Rate limit exceeded (429)', { requestId, httpStatus });
        return {
          provider: this.id,
          status: 'failed',
          resultImage: null,
          providerTaskId: null,
          errorCode: 'PERFECTCORP_RATE_LIMITED',
          errorMessage: 'Perfect Corp rate limit exceeded (HTTP 429). Retry in a few moments.',
          durationMs: Date.now() - startTime,
        };
      }

      if (!createResponse.ok) {
        const errText = await createResponse.text().catch(() => '');
        logger.error(`[PerfectCorp] Task creation HTTP error ${httpStatus}`, { requestId, errSnippet: errText.slice(0, 200) });
        return {
          provider: this.id,
          status: 'failed',
          resultImage: null,
          providerTaskId: null,
          errorCode: 'PERFECTCORP_PROVIDER_ERROR',
          errorMessage: `Failed to create task at Perfect Corp (HTTP ${httpStatus}): ${errText.slice(0, 200) || createResponse.statusText}`,
          durationMs: Date.now() - startTime,
        };
      }

      const createData = await createResponse.json();
      const taskId = createData.task_id || createData.data?.task_id || createData.id || null;

      if (!taskId) {
        logger.error('[PerfectCorp] Missing task_id in creation response', { requestId, response: createData });
        return {
          provider: this.id,
          status: 'failed',
          resultImage: null,
          providerTaskId: null,
          errorCode: 'PERFECTCORP_TASK_FAILED',
          errorMessage: 'Perfect Corp response did not contain a valid task_id.',
          durationMs: Date.now() - startTime,
        };
      }

      logger.info('[PerfectCorp] Task created', { requestId, taskId, status: 'created' });

      // 4. Polling loop
      const pollIntervalMs = 3000;
      const maxTimeoutMs = 60000; // 60s
      const maxAttempts = Math.floor(maxTimeoutMs / pollIntervalMs);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        const statusUrl = `${taskEndpoint}/${taskId}`;
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (statusResponse.status === 429) {
          logger.warn('[PerfectCorp] Rate limit during status polling', { requestId, taskId, attempt });
          return {
            provider: this.id,
            status: 'failed',
            resultImage: null,
            providerTaskId: taskId,
            errorCode: 'PERFECTCORP_RATE_LIMITED',
            errorMessage: 'Rate limit exceeded during status polling.',
            durationMs: Date.now() - startTime,
          };
        }

        if (!statusResponse.ok) {
          logger.warn(`[PerfectCorp] Polling HTTP error ${statusResponse.status}`, { requestId, taskId, attempt });
          continue;
        }

        const statusData = await statusResponse.json();
        const rawStatus = String(
          statusData.data?.task_status ||
          statusData.data?.status ||
          statusData.task_status ||
          (typeof statusData.status === 'string' ? statusData.status : '') ||
          ''
        ).toUpperCase();

        logger.info('[PerfectCorp] Task status check', { requestId, taskId, status: rawStatus, attempt });

        if (rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED' || rawStatus === 'FINISH') {
          const rawResultUrl =
            statusData.data?.results?.url ||
            statusData.data?.result_file_url ||
            statusData.data?.url ||
            statusData.results?.url ||
            statusData.result_file_url ||
            statusData.url ||
            null;

          if (!rawResultUrl) {
            logger.error('[PerfectCorp] Task succeeded but result URL is missing', { requestId, taskId });
            return {
              provider: this.id,
              status: 'failed',
              resultImage: null,
              providerTaskId: taskId,
              errorCode: 'PERFECTCORP_TASK_FAILED',
              errorMessage: 'Task completed by Perfect Corp, but result image URL was missing in response.',
              durationMs: Date.now() - startTime,
            };
          }

          // Download image, store in try-on-results bucket, generate 7-day signed URL
          let finalResultImageUrl = rawResultUrl;
          try {
            const imgRes = await fetch(rawResultUrl);
            if (!imgRes.ok) {
              throw new Error(`Failed to download result image from ${rawResultUrl} (HTTP ${imgRes.status})`);
            }
            const arrayBuffer = await imgRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            if (buffer.length > 0) {
              const signedUrl = await this.storageService.saveResultImage(buffer, `perfectcorp_${taskId}.jpg`);
              if (signedUrl && !signedUrl.includes('placeholder')) {
                finalResultImageUrl = signedUrl;
              }
            }
          } catch (downloadErr: any) {
            logger.warn('[PerfectCorp] Could not store to Supabase, using direct signed provider URL', {
              requestId,
              taskId,
              error: downloadErr.message,
            });
          }

          logger.info('[PerfectCorp] Task completed and result stored successfully', {
            requestId,
            taskId,
            status: 'success',
            durationMs: Date.now() - startTime,
          });

          return {
            provider: this.id,
            status: 'success',
            resultImage: finalResultImageUrl,
            providerTaskId: taskId,
            errorCode: null,
            errorMessage: null,
            durationMs: Date.now() - startTime,
          };
        }

        if (rawStatus === 'FAILED' || rawStatus === 'ERROR') {
          const reason =
            statusData.data?.error_msg ||
            statusData.data?.error ||
            statusData.error_msg ||
            statusData.error ||
            statusData.message ||
            'Task processing failed at AI engine.';
          logger.error('[PerfectCorp] Task failed at engine', { requestId, taskId, reason });
          return {
            provider: this.id,
            status: 'failed',
            resultImage: null,
            providerTaskId: taskId,
            errorCode: 'PERFECTCORP_TASK_FAILED',
            errorMessage: `Perfect Corp engine processing failed: ${reason}`,
            durationMs: Date.now() - startTime,
          };
        }

        // Status is still PROCESSING / IN_PROGRESS / INIT -> loop continues
      }

      // Timeout reached after 60s
      logger.error('[PerfectCorp] Task polling timed out (60s)', { requestId, taskId });
      return {
        provider: this.id,
        status: 'timeout',
        resultImage: null,
        providerTaskId: taskId,
        errorCode: 'PERFECTCORP_TIMEOUT',
        errorMessage: 'Perfect Corp task timed out after 60 seconds.',
        durationMs: Date.now() - startTime,
      };

    } catch (err: any) {
      logger.error('[PerfectCorp] Exception during execution', { requestId, error: err.message });
      return {
        provider: this.id,
        status: 'failed',
        resultImage: null,
        providerTaskId: null,
        errorCode: 'PERFECTCORP_PROVIDER_ERROR',
        errorMessage: `Perfect Corp provider exception: ${err.message || 'Network failure'}`,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
