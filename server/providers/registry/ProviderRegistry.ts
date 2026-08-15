// server/providers/registry/ProviderRegistry.ts
import { ITryOnProvider } from '../interfaces/ITryOnProvider.js';
import { ProviderCapabilities } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, ITryOnProvider> = new Map();

  private constructor() {}

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Resets registry (primarily for testing purposes).
   */
  public reset(): void {
    this.providers.clear();
  }

  /**
   * Registers a new TryOnProvider.
   * Throws an error if provider ID is already registered.
   */
  public register(provider: ITryOnProvider): void {
    const id = provider.id.toLowerCase();
    if (this.providers.has(id)) {
      throw new Error(`PROVIDER_ALREADY_REGISTERED: Provider with ID '${id}' is already registered.`);
    }
    this.providers.set(id, provider);
    logger.info(`Registered AI TryOnProvider: ${provider.name} (${id})`);
  }

  /**
   * Gets a registered provider by ID.
   * Throws PROVIDER_NOT_FOUND if ID is not registered.
   */
  public get(id: string): ITryOnProvider {
    const key = id.toLowerCase();
    const provider = this.providers.get(key);
    if (!provider) {
      throw new Error(`PROVIDER_NOT_FOUND: Provider '${id}' is not registered in ProviderRegistry.`);
    }
    return provider;
  }

  /**
   * Checks if a provider ID is registered.
   */
  public has(id: string): boolean {
    return this.providers.has(id.toLowerCase());
  }

  /**
   * Returns capabilities for a given provider ID.
   */
  public getCapabilities(id: string): ProviderCapabilities {
    const provider = this.get(id);
    return provider.capabilities;
  }

  /**
   * Lists all registered provider IDs.
   */
  public listAvailable(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Returns list of all registered provider details.
   */
  public listProvidersInfo(): { id: string; name: string; capabilities: ProviderCapabilities }[] {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      capabilities: p.capabilities,
    }));
  }
}
