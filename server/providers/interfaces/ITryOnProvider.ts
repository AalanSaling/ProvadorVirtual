// server/providers/interfaces/ITryOnProvider.ts
import { ProviderCapabilities, TryOnInput, TryOnResult, ExecutionContext } from '../../types/index.js';

export interface ITryOnProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  /**
   * Validates if provider credentials / configuration are ready.
   * Can receive explicit ExecutionContext or partial credentials for validation.
   */
  validateConfiguration(context?: Partial<ExecutionContext>): Promise<boolean>;

  /**
   * Executes Virtual Try-On for the given input and execution context.
   * Context provides the dynamic per-store API key (storeApiKey).
   * Input strictly follows: personImage (main subject) + garmentImage (garment reference).
   * Never falls back silently on error; returns error metadata in TryOnResult.
   */
  generateTryOn(input: TryOnInput, context?: ExecutionContext): Promise<TryOnResult>;
}

