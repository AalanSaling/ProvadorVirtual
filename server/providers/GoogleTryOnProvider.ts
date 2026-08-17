// server/providers/GoogleTryOnProvider.ts
import { GoogleGenAI } from '@google/genai';
import { ITryOnProvider } from './interfaces/ITryOnProvider.js';
import { ProviderCapabilities, TryOnInput, TryOnResult, ExecutionContext } from '../types/index.js';
import { PromptBuilder } from '../services/PromptBuilder.js';

export class GoogleTryOnProvider implements ITryOnProvider {
  readonly id = 'google';
  readonly name = 'Google Gemini AI';
  readonly capabilities: ProviderCapabilities = {
    upperBody: true,
    lowerBody: true,
    fullBody: true,
    shoes: true,
  };

  public async validateConfiguration(context?: Partial<ExecutionContext>): Promise<boolean> {
    const key = context?.storeApiKey || this.getApiKey();
    return Boolean(key);
  }

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

  async generateTryOn(input: TryOnInput, context?: ExecutionContext): Promise<TryOnResult> {
    const startTime = Date.now();
    const apiKey = context?.storeApiKey || this.getApiKey();

    if (!apiKey) {
      return {
        provider: 'google',
        status: 'failed',
        resultImage: null,
        providerTaskId: null,
        durationMs: Date.now() - startTime,
        errorCode: 'GOOGLE_AUTH_ERROR',
        errorMessage: `STORE_PROVIDER_CREDENTIAL_NOT_CONFIGURED: Chave de API do Google Gemini não configurada para a loja ${context?.storeId || input.storeId}.`,
      };
    }

    const modelName = this.getModelName();

    try {
      // Prepare image parts with explicit semantic roles
      const personPartData = await this.prepareImagePart(input.personImage, 'Foto da pessoa (SUJEITO PRINCIPAL)');
      const garmentPartData = await this.prepareImagePart(input.garmentImage, 'Foto da roupa (OBJETO)');

      // Initialize per-request client instance with the store-specific API key
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Strict, centralized, versioned instruction prompt for Gemini image generation/editing
      const promptText = PromptBuilder.buildTryOnPrompt(input.garmentCategory, {
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
        category: input.garmentCategory,
      });

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
          resultImage: null,
          providerTaskId: null,
          durationMs: Date.now() - startTime,
          errorCode: 'GOOGLE_PROVIDER_ERROR',
          errorMessage: `O modelo do Google gerou texto em vez de uma imagem de provador. Resposta do modelo: "${textOutput.slice(0, 200)}"`,
        };
      }

      return {
        provider: 'google',
        status: 'success',
        resultImage: generatedImageBase64,
        providerTaskId: null,
        durationMs: Date.now() - startTime,
        errorCode: null,
        errorMessage: null,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
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
          resultImage: null,
          providerTaskId: null,
          durationMs,
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
          resultImage: null,
          providerTaskId: null,
          durationMs,
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
          resultImage: null,
          providerTaskId: null,
          durationMs,
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
          resultImage: null,
          providerTaskId: null,
          durationMs,
          errorCode: 'GOOGLE_MODEL_UNAVAILABLE',
          errorMessage: `O modelo de imagem configurado ("${modelName}") está temporariamente indisponível.`,
        };
      }

      return {
        provider: 'google',
        status: 'error',
        resultImage: null,
        providerTaskId: null,
        durationMs,
        errorCode: 'GOOGLE_PROVIDER_ERROR',
        errorMessage: `Erro de processamento no Google Gemini: ${errString.slice(0, 300)}`,
      };
    }
  }
}
