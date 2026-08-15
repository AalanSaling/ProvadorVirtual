// server/providers/interfaces/ITryOnProvider.ts
import { ProviderCapabilities, TryOnInput, TryOnResult } from '../../types/index.js';

export interface ITryOnProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  /**
   * Validates if provider credentials / configuration are ready in backend environment.
   */
  validateConfiguration(): Promise<boolean>;

  /**
   * Executes Virtual Try-On for the given input.
   * Input strictly follows: personImage (main subject) + garmentImage (garment reference).
   * Never falls back silently on error; returns error metadata in TryOnResult.
   */
  generateTryOn(input: TryOnInput): Promise<TryOnResult>;
}
