// server/providers/PerfectCorpTryOnProvider.ts
import {
  TryOnProvider,
  TryOnInput,
  ProviderResult,
  GarmentCategoryType,
} from './types';

export class PerfectCorpTryOnProvider implements TryOnProvider {
  readonly providerName = 'perfectcorp' as const;

  private getApiKey(): string | null {
    return (
      process.env.PERFECTCORP_API_KEY ||
      process.env.PERFECT_CORP_API_KEY ||
      process.env.PERFECTCORP_CLIENT_SECRET ||
      null
    );
  }

  private getApiHost(): string {
    return process.env.PERFECTCORP_API_HOST || 'https://s2s.perfectcorp.com';
  }

  /**
   * Validates image format and size constraints according to Perfect Corp specifications.
   * JPEG/PNG/WEBP, up to 10MB.
   */
  private validateImage(imageData: string, imageName: string): { valid: boolean; error?: string } {
    if (!imageData || typeof imageData !== 'string' || imageData.trim().length === 0) {
      return { valid: false, error: `${imageName} é obrigatória e não foi fornecida.` };
    }

    if (imageData.startsWith('data:')) {
      const match = imageData.match(/^data:(image\/(jpeg|png|jpg|webp));base64,(.+)$/i);
      if (!match) {
        return {
          valid: false,
          error: `${imageName} possui formato inválido. Utilize JPEG, PNG ou WEBP.`,
        };
      }
      const base64Str = match[3];
      const estimatedBytes = (base64Str.length * 3) / 4;
      const maxBytes = 10 * 1024 * 1024; // 10 MB limit
      if (estimatedBytes > maxBytes) {
        return {
          valid: false,
          error: `${imageName} excede o tamanho máximo permitido de 10 MB (${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB).`,
        };
      }
      return { valid: true };
    }

    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      return { valid: true };
    }

    return {
      valid: false,
      error: `${imageName} deve ser um Data URI Base64 válido ou uma URL HTTP(S) acessível.`,
    };
  }

  private mapGarmentCategory(category: GarmentCategoryType): string {
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

  async generateTryOn(input: TryOnInput): Promise<ProviderResult> {
    const startTime = Date.now();

    // 1. Validate Person Image
    const personVal = this.validateImage(input.personImage, 'Foto da pessoa (src)');
    if (!personVal.valid) {
      return {
        provider: 'perfectcorp',
        status: 'failed',
        image: null,
        taskId: null,
        latencyMs: Date.now() - startTime,
        errorCode: 'PERFECTCORP_INVALID_IMAGE',
        errorMessage: personVal.error || 'Foto da pessoa com formato ou tamanho inválido.',
      };
    }

    // 2. Validate Garment Image
    const garmentVal = this.validateImage(input.garmentImage, 'Foto da roupa (ref)');
    if (!garmentVal.valid) {
      return {
        provider: 'perfectcorp',
        status: 'failed',
        image: null,
        taskId: null,
        latencyMs: Date.now() - startTime,
        errorCode: 'PERFECTCORP_INVALID_IMAGE',
        errorMessage: garmentVal.error || 'Foto da roupa do catálogo com formato ou tamanho inválido.',
      };
    }

    // 3. Validate Credentials
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        provider: 'perfectcorp',
        status: 'failed',
        image: null,
        taskId: null,
        latencyMs: Date.now() - startTime,
        errorCode: 'PERFECTCORP_AUTH_ERROR',
        errorMessage: 'Chave de API da Perfect Corp (PERFECTCORP_API_KEY) não configurada nos segredos do servidor.',
      };
    }

    const apiHost = this.getApiHost();
    const taskEndpoint = `${apiHost}/s2s/v2.0/task/cloth-v3`;
    const garmentCategory = this.mapGarmentCategory(input.garmentCategory);

    try {
      // 4. Create Task
      const createResponse = await fetch(taskEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          src_file_url: input.personImage,
          ref_file_url: input.garmentImage,
          garment_category: garmentCategory,
        }),
      });

      if (createResponse.status === 429) {
        return {
          provider: 'perfectcorp',
          status: 'failed',
          image: null,
          taskId: null,
          latencyMs: Date.now() - startTime,
          errorCode: 'PERFECTCORP_RATE_LIMITED',
          errorMessage: 'A API da Perfect Corp atingiu o limite de requisições por minuto (Rate Limit 429). Tente novamente em instantes.',
        };
      }

      if (createResponse.status === 401 || createResponse.status === 403) {
        return {
          provider: 'perfectcorp',
          status: 'failed',
          image: null,
          taskId: null,
          latencyMs: Date.now() - startTime,
          errorCode: 'PERFECTCORP_AUTH_ERROR',
          errorMessage: 'Credencial ou token da Perfect Corp rejeitado pelo servidor (Erro de Autenticação).',
        };
      }

      if (!createResponse.ok) {
        const errText = await createResponse.text().catch(() => '');
        return {
          provider: 'perfectcorp',
          status: 'failed',
          image: null,
          taskId: null,
          latencyMs: Date.now() - startTime,
          errorCode: 'PERFECTCORP_PROVIDER_ERROR',
          errorMessage: `Falha ao criar tarefa na Perfect Corp (HTTP ${createResponse.status}): ${errText || createResponse.statusText}`,
        };
      }

      const createData = await createResponse.json();
      const taskId = createData.task_id || createData.data?.task_id || createData.id || null;

      if (!taskId) {
        return {
          provider: 'perfectcorp',
          status: 'failed',
          image: null,
          taskId: null,
          latencyMs: Date.now() - startTime,
          errorCode: 'PERFECTCORP_TASK_FAILED',
          errorMessage: 'A Perfect Corp não retornou um ID de tarefa válido na resposta.',
        };
      }

      // 5. Poll Task Status (Controlled polling)
      const pollIntervalMs = 3000;
      const maxTimeoutMs = 60000; // 60s max
      const maxAttempts = Math.floor(maxTimeoutMs / pollIntervalMs);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));

        const statusUrl = `${taskEndpoint}/${taskId}`;
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'x-api-key': apiKey,
          },
        });

        if (statusResponse.status === 429) {
          return {
            provider: 'perfectcorp',
            status: 'failed',
            image: null,
            taskId,
            latencyMs: Date.now() - startTime,
            errorCode: 'PERFECTCORP_RATE_LIMITED',
            errorMessage: 'Limite de taxa excedido durante a consulta de status na Perfect Corp.',
          };
        }

        if (!statusResponse.ok) {
          continue; // Retry on transient status check failure
        }

        const statusData = await statusResponse.json();
        const taskStatus = (statusData.status || statusData.data?.status || '').toUpperCase();

        if (taskStatus === 'SUCCESS' || taskStatus === 'COMPLETED' || taskStatus === 'FINISH') {
          const resultUrl =
            statusData.result_file_url ||
            statusData.data?.result_file_url ||
            statusData.data?.url ||
            statusData.url ||
            null;

          if (!resultUrl) {
            return {
              provider: 'perfectcorp',
              status: 'failed',
              image: null,
              taskId,
              latencyMs: Date.now() - startTime,
              errorCode: 'PERFECTCORP_TASK_FAILED',
              errorMessage: 'A tarefa foi concluída pela Perfect Corp mas nenhuma URL de imagem foi gerada.',
            };
          }

          return {
            provider: 'perfectcorp',
            status: 'success',
            image: resultUrl,
            taskId,
            latencyMs: Date.now() - startTime,
            errorCode: null,
            errorMessage: null,
          };
        }

        if (taskStatus === 'FAILED' || taskStatus === 'ERROR') {
          const reason = statusData.error || statusData.data?.error || 'A tarefa falhou durante o processamento de IA.';
          return {
            provider: 'perfectcorp',
            status: 'failed',
            image: null,
            taskId,
            latencyMs: Date.now() - startTime,
            errorCode: 'PERFECTCORP_TASK_FAILED',
            errorMessage: `Erro no motor da Perfect Corp: ${reason}`,
          };
        }
      }

      // Timeout reached
      return {
        provider: 'perfectcorp',
        status: 'timeout',
        image: null,
        taskId,
        latencyMs: Date.now() - startTime,
        errorCode: 'PERFECTCORP_TIMEOUT',
        errorMessage: 'O tempo limite de processamento da Perfect Corp foi excedido (60s).',
      };
    } catch (err: any) {
      return {
        provider: 'perfectcorp',
        status: 'error',
        image: null,
        taskId: null,
        latencyMs: Date.now() - startTime,
        errorCode: 'PERFECTCORP_PROVIDER_ERROR',
        errorMessage: `Erro de conexão com o provedor Perfect Corp: ${err.message || 'Falha de rede.'}`,
      };
    }
  }
}
