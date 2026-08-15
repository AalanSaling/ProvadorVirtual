// server/providers/mocks/MockGoogleGeminiProvider.ts
import { ITryOnProvider } from '../interfaces/ITryOnProvider.js';
import { ProviderCapabilities, TryOnInput, TryOnResult } from '../../types/index.js';
import { env } from '../../config/env.js';

export class MockGoogleGeminiProvider implements ITryOnProvider {
  readonly id = 'google';
  readonly name = `Google Gemini (${env.GOOGLE_IMAGE_MODEL}) (Mock Infrastructure)`;
  readonly capabilities: ProviderCapabilities = {
    upperBody: true,
    lowerBody: true,
    fullBody: true,
    shoes: true,
  };

  private shouldFail = false;

  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
  }

  public setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  async validateConfiguration(): Promise<boolean> {
    return true;
  }

  async generateTryOn(input: TryOnInput): Promise<TryOnResult> {
    const startTime = Date.now();

    if (this.shouldFail) {
      return {
        provider: this.id,
        status: 'failed',
        resultImage: null,
        providerTaskId: null,
        errorCode: 'GEMINI_MOCK_ERROR',
        errorMessage: 'Mock Google Gemini provider simulated failure.',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      provider: this.id,
      status: 'success',
      resultImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80',
      providerTaskId: `task-gemini-${Date.now()}`,
      errorCode: null,
      errorMessage: null,
      durationMs: Date.now() - startTime,
    };
  }
}
