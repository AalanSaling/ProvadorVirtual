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
    const host = process.env.PERFECTCORP_API_HOST || 'https://s2s.perfectcorp.com';
    return host.replace(/\/+$/, '');
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

    // 1. Validate Credentials
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

    // 2. Validate URLs (Must be HTTP/HTTPS URLs produced by storage pipeline)
    if (!input.personImage.startsWith('http://') && !input.personImage.startsWith('https://')) {
      return {
        provider: 'perfectcorp',
        status: 'failed',
        image: null,
        taskId: null,
        latencyMs: Date.now() - startTime,
        errorCode: 'PERFECTCORP_INVALID_IMAGE',
        errorMessage: 'A foto da pessoa (src_file_url) deve ser convertida em uma URL HTTP(S) acessível antes de ser enviada à Perfect Corp.',
      };
    }

    if (!input.garmentImage.startsWith('http://') && !input.garmentImage.startsWith('https://')) {
      return {
        provider: 'perfectcorp',
        status: 'failed',
        image: null,
        taskId: null,
        latencyMs: Date.now() - startTime,
        errorCode: 'PERFECTCORP_INVALID_IMAGE',
        errorMessage: 'A foto da roupa (ref_file_url) deve ser convertida em uma URL HTTP(S) acessível antes de ser enviada à Perfect Corp.',
      };
    }

    const apiHost = this.getApiHost();
    const taskEndpoint = `${apiHost}/s2s/v2.0/task/cloth-v3`;
    const garmentCategory = this.mapGarmentCategory(input.garmentCategory);

    try {
      // 3. Create Task (src_file_url = PESSOA, ref_file_url = ROUPA - NUNCA INVERTER)
      const createResponse = await fetch(taskEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          src_file_url: input.personImage, // PESSOA
          ref_file_url: input.garmentImage, // ROUPA
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
          errorMessage: 'Credencial ou token da Perfect Corp rejeitado pelo servidor (Erro de Autenticação 401/403).',
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
          errorMessage: `Falha ao criar tarefa na Perfect Corp (HTTP ${createResponse.status}): ${errText.slice(0, 300) || createResponse.statusText}`,
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
          errorMessage: 'A Perfect Corp não retornou um ID de tarefa válido na resposta de criação.',
        };
      }

      // 4. Controlled Polling with Timeout
      const pollIntervalMs = 3000;
      const maxTimeoutMs = 60000; // 60s max limit
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
          continue; // Retry transient status query failures
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
              errorMessage: 'A tarefa foi concluída pela Perfect Corp, mas nenhuma URL de imagem foi retornada.',
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
