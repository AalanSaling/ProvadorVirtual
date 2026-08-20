// server/services/StoreCredentialService.ts
import { ProviderRegistry } from '../providers/registry/ProviderRegistry.js';
import { supabaseAdmin } from '../middleware/authMiddleware.js';
import { ISecretStore, EncryptedFileSecretStore } from './SecretStore.js';
import { logger } from '../utils/logger.js';

export class StoreCredentialService {
  private static instance: StoreCredentialService;

  private secretStore: ISecretStore;

  constructor(customSecretStore?: ISecretStore) {
    this.secretStore = customSecretStore || new EncryptedFileSecretStore();
    this.initDefaultEnvFallback();
  }

  public static getInstance(): StoreCredentialService {
    if (!StoreCredentialService.instance) {
      StoreCredentialService.instance = new StoreCredentialService();
    }
    return StoreCredentialService.instance;
  }

  /**
   * For testing purposes to reset or inject mock secret stores.
   */
  public static setInstance(instance: StoreCredentialService): void {
    StoreCredentialService.instance = instance;
  }

  private async initDefaultEnvFallback() {
    const storesToBootstrap = ['store-atelier-01'];

    const pcKey = process.env.PERFECTCORP_API_KEY || process.env.PERFECT_CORP_API_KEY;
    if (pcKey && pcKey.trim() && pcKey !== 'demo-perfectcorp-key') {
      for (const sId of storesToBootstrap) {
        const has = await this.secretStore.hasSecret(sId, 'perfectcorp');
        if (!has) {
          await this.secretStore.setSecret(sId, 'perfectcorp', pcKey.trim());
        }
      }
    }

    const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (googleKey && googleKey.trim() && googleKey !== 'demo-google-key') {
      for (const sId of storesToBootstrap) {
        const has = await this.secretStore.hasSecret(sId, 'google');
        if (!has) {
          await this.secretStore.setSecret(sId, 'google', googleKey.trim());
        }
      }
    }
  }

  /**
   * Retrieves the raw API key for a specific store and provider.
   * Internal server-side use ONLY. Never expose in API responses.
   */
  public async getCredential(storeId: string, providerId: string): Promise<string | null> {
    const storeSecret = await this.secretStore.getSecret(storeId, providerId);
    if (storeSecret) {
      return storeSecret;
    }

    // Strict isolation: Do not fall back to global process.env if store is explicitly requested
    return null;
  }

  /**
   * Securely saves/updates a credential for a given store and provider in the persistent vault.
   */
  public async setCredential(
    storeId: string,
    providerId: string,
    apiKey: string
  ): Promise<{ masked: string }> {
    const trimmed = apiKey.trim();
    const result = await this.secretStore.setSecret(storeId, providerId, trimmed);

    logger.info(`[StoreCredentialService] Secure credential persisted for store: ${storeId}, provider: ${providerId}`);
    return result;
  }

  /**
   * Deletes a credential from the store vault.
   */
  public async deleteCredential(storeId: string, providerId: string): Promise<boolean> {
    const existed = await this.secretStore.deleteSecret(storeId, providerId);
    logger.info(`[StoreCredentialService] Credential deleted for store: ${storeId}, provider: ${providerId}`);
    return existed;
  }

  /**
   * Records provider connectivity test result.
   */
  public async recordTestResult(
    storeId: string,
    providerId: string,
    status: 'success' | 'failed',
    message?: string
  ): Promise<void> {
    await this.secretStore.recordTestResult(storeId, providerId, status, message);
  }

  /**
   * Gets safe masked status for all providers of a store.
   * Safe for client consumption. Never returns plaintext secrets.
   */
  public async getStoreProviders(storeId: string) {
    // 1. Fetch non-secret configs from store_provider_configs
    const { data } = await supabaseAdmin
      .from('store_provider_configs')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    const enabledProviders: string[] = data?.enabled_providers || ['perfectcorp', 'google'];
    const defaultProvider: string | null = data?.default_provider || 'perfectcorp';

    const registry = ProviderRegistry.getInstance();
    const availableProviders = registry.listProvidersInfo();

    const result = await Promise.all(
      availableProviders.map(async info => {
        const entry = await this.secretStore.getEntry(storeId, info.id);
        const hasSecret = Boolean(entry);

        return {
          provider: info.id,
          id: info.id,
          name: info.name,
          description: info.id === 'perfectcorp' ? 'Provador virtual com IA' : 'Provador virtual com IA',
          configured: hasSecret,
          enabled: enabledProviders.includes(info.id),
          isDefault: defaultProvider === info.id,
          masked: entry?.masked || null,
          lastTest: entry?.lastTest || undefined,
        };
      })
    );

    return {
      storeId,
      enabledProviders,
      defaultProvider,
      providers: result,
    };
  }
}
