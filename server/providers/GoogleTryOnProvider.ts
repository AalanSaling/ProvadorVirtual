// server/providers/GoogleTryOnProvider.ts
import { GoogleGenAI } from '@google/genai';
import {
  TryOnProvider,
  TryOnInput,
  ProviderResult,
} from './types';

export class GoogleTryOnProvider implements TryOnProvider {
  readonly providerName = 'google' as const;

  /**
   * Model configuration isolated in constant/env variable so model name can be changed
   * without affecting application logic.
   */
  private getModelName(): string {
    return process.env.GOOGLE_IMAGE_MODEL || 'gemini-3.1-flash-image';
  }

  private getApiKey(): string | null {
    return (
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      null
    );
  }

  /**
   * Helper to convert base64 or URL into inlineData part for @google/genai SDK
   */
  private async prepareImagePart(imageInput: string, labelName: string): Promise<{ mimeType: string; data: string }> {
    if (imageInput.startsWith('data:')) {
      const match = imageInput.match(/^data:(image\/(jpeg|png|jpg|webp));base64,(.+)$/i);
      if (!match) {
        throw new Error(`${labelName}: Formato base64 inválido. Suportados: JPEG, PNG, WEBP.`);
      }
      const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
      return {
        mimeType,
        data: match[3],
      };
    }

    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      const resp = await fetch(imageInput);
      if (!resp.ok) {
        throw new Error(`${labelName}: Não foi possível carregar imagem da URL (HTTP ${resp.status}).`);
      }
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await resp.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      return {
        mimeType: contentType.split(';')[0],
        data: base64Data,
      };
    }

    throw new Error(`${labelName}: Imagem fornecida deve ser Data URI base64 ou URL HTTP(S).`);
  }

  async generateTryOn(input: TryOnInput): Promise<ProviderResult> {
    const startTime = Date.now();
    const apiKey = this.getApiKey();

    if (!apiKey) {
      return {
        provider: 'google',
        status: 'failed',
        image: null,
        taskId: null,
        latencyMs: Date.now() - startTime,
        errorCode: 'GOOGLE_AUTH_ERROR',
        errorMessage: 'Chave de API do Google Gemini (GOOGLE_API_KEY) não configurada nos segredos do servidor.',
      };
    }

    const modelName = this.getModelName();

    try {
      // Prepare image parts with explicit semantic roles
      const personPartData = await this.prepareImagePart(input.personImage, 'Foto da pessoa (SUJEITO PRINCIPAL)');
      const garmentPartData = await this.prepareImagePart(input.garmentImage, 'Foto da roupa (OBJETO)');

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Strict, explicit instruction prompt for Gemini image generation/editing
      const promptText = `
Você é um motor especializado em Provador Virtual de Roupas (Virtual Try-On fotorealista).

IMPORTANTE - REGRAS E SEMÂNTICA RÍGIDA:
1. A PRIMEIRA IMAGEM É A PESSOA (SUJEITO PRINCIPAL DO PROVADOR VIRTUAL).
2. A SEGUNDA IMAGEM É A ROUPA (OBJETO A SER VESTIDO NELA).
3. NUNCA INVERTA AS IMAGENS OU AS FUNÇÕES DA PESSOA E DA ROUPA.

INSTRUÇÕES OBRIGATÓRIAS:
- A PESSOA É O SUJEITO PRINCIPAL. A ROUPA É O OBJETO A SER VESTIDO NELA.
- Preserve integralmente a identidade visual da pessoa: mantenha exatamente o mesmo rosto, feição, cabelo, tom de pele e expressão.
- Preserve a pose da pessoa, o formato do corpo e as proporções físicas originais.
- Vista a pessoa com a roupa fornecida na segunda imagem.
- A roupa deve se adaptar perfeitamente ao corpo da pessoa de maneira fluida, natural e com dobras/caimento realistas.
- Preserve o design, a cor, a estampa, o padrão, os detalhes de costura e a textura original da peça de roupa.
- Mantenha a iluminação, sombras e o fundo da foto da pessoa coerentes e naturais.
- NÃO coloque a pessoa dentro do cenário da foto da roupa.
- NÃO crie uma colagem ou montagem de lado a lado.
- NÃO aplique a roupa como se fosse um adesivo ou textura plana sobre a foto.
- NÃO crie pessoas extras nem altere o sexo, idade ou fisionomia da pessoa.
- NÃO invente outra roupa que não seja a peça de referência fornecida.
- O resultado DEVE ser uma única fotografia de alta resolução da pessoa vestindo a roupa especificada (${input.garmentCategory || 'vestuário'}).
`.trim();

      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: personPartData.mimeType,
                data: personPartData.data,
              },
            },
            {
              inlineData: {
                mimeType: garmentPartData.mimeType,
                data: garmentPartData.data,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      });

      // Search for image output in candidate parts
      let generatedImageBase64: string | null = null;
      const candidates = response.candidates || [];

      if (candidates.length > 0 && candidates[0].content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            generatedImageBase64 = `data:${mime};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (!generatedImageBase64) {
        // If model returned text instead of an image
        const textOutput = response.text || '';
        return {
          provider: 'google',
          status: 'failed',
          image: null,
          taskId: null,
          latencyMs: Date.now() - startTime,
          errorCode: 'GOOGLE_PROVIDER_ERROR',
          errorMessage: `O modelo do Google gerou texto em vez de uma imagem de provador. Resposta do modelo: "${textOutput.slice(0, 200)}"`,
        };
      }

      return {
        provider: 'google',
        status: 'success',
        image: generatedImageBase64,
        taskId: null,
        latencyMs: Date.now() - startTime,
        errorCode: null,
        errorMessage: null,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errString = String(err?.message || err);

      // Handle Quota and Rate Limits explicitly
      if (
        errString.includes('429') ||
        errString.includes('RESOURCE_EXHAUSTED') ||
        errString.toLowerCase().includes('rate limit')
      ) {
        return {
          provider: 'google',
          status: 'failed',
          image: null,
          taskId: null,
          latencyMs,
          errorCode: 'GOOGLE_RATE_LIMITED',
          errorMessage: 'O serviço do Google Gemini atingiu o limite de requisições por minuto (429 Rate Limit). Tente novamente em instantes.',
        };
      }

      if (
        errString.toLowerCase().includes('quota') ||
        errString.toLowerCase().includes('quota_exceeded') ||
        errString.toLowerCase().includes('billing')
      ) {
        return {
          provider: 'google',
          status: 'failed',
          image: null,
          taskId: null,
          latencyMs,
          errorCode: 'GOOGLE_QUOTA_EXCEEDED',
          errorMessage: 'Cota de uso da API do Google Gemini excedida para o projeto/chave atual.',
        };
      }

      if (
        errString.includes('401') ||
        errString.includes('403') ||
        errString.toLowerCase().includes('api key') ||
        errString.toLowerCase().includes('permission')
      ) {
        return {
          provider: 'google',
          status: 'failed',
          image: null,
          taskId: null,
          latencyMs,
          errorCode: 'GOOGLE_AUTH_ERROR',
          errorMessage: 'Chave do Google Gemini inválida ou sem permissão para o modelo de geração de imagem.',
        };
      }

      if (
        errString.toLowerCase().includes('model') ||
        errString.toLowerCase().includes('not found') ||
        errString.toLowerCase().includes('unavailable')
      ) {
        return {
          provider: 'google',
          status: 'failed',
          image: null,
          taskId: null,
          latencyMs,
          errorCode: 'GOOGLE_MODEL_UNAVAILABLE',
          errorMessage: `O modelo de imagem configurado ("${modelName}") está temporariamente indisponível.`,
        };
      }

      return {
        provider: 'google',
        status: 'error',
        image: null,
        taskId: null,
        latencyMs,
        errorCode: 'GOOGLE_PROVIDER_ERROR',
        errorMessage: `Erro de processamento no Google Gemini: ${errString.slice(0, 300)}`,
      };
    }
  }
}
