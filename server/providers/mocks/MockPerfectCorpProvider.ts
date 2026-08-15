// server/providers/mocks/MockPerfectCorpProvider.ts
import { ITryOnProvider } from '../interfaces/ITryOnProvider.js';
import { ProviderCapabilities, TryOnInput, TryOnResult } from '../../types/index.js';

export class MockPerfectCorpProvider implements ITryOnProvider {
  readonly id = 'perfectcorp';
  readonly name = 'Perfect Corp Virtual Try-On (Mock Infrastructure)';
  readonly capabilities: ProviderCapabilities = {
    upperBody: true,
    lowerBody: true,
    fullBody: true,
    shoes: false,
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
        errorCode: 'PERFECTCORP_MOCK_ERROR',
        errorMessage: 'Mock Perfect Corp provider simulated failure.',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      provider: this.id,
      status: 'success',
      resultImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
      providerTaskId: `task-pc-${Date.now()}`,
      errorCode: null,
      errorMessage: null,
      durationMs: Date.now() - startTime,
    };
  }
}
