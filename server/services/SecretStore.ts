// server/services/SecretStore.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export interface SecretStoreEntry {
  encryptedValue: string;
  iv: string;
  tag: string;
  masked: string;
  updatedAt: string;
  lastTest?: {
    status: 'success' | 'failed';
    testedAt: string;
    message?: string;
  };
}

export interface ISecretStore {
  setSecret(storeId: string, providerId: string, secret: string): Promise<{ masked: string }>;
  getSecret(storeId: string, providerId: string): Promise<string | null>;
  deleteSecret(storeId: string, providerId: string): Promise<boolean>;
  hasSecret(storeId: string, providerId: string): Promise<boolean>;
  getMasked(storeId: string, providerId: string): Promise<string | null>;
  getEntry(storeId: string, providerId: string): Promise<SecretStoreEntry | null>;
  recordTestResult(storeId: string, providerId: string, status: 'success' | 'failed', message?: string): Promise<void>;
  listStoreSecrets(storeId: string): Promise<Record<string, { configured: boolean; masked: string | null; lastTest?: any }>>;
}

export class EncryptedFileSecretStore implements ISecretStore {
  private masterKey: Buffer;
  private filePath: string;
  private vault: Map<string, SecretStoreEntry> = new Map();
  private isLoaded = false;

  constructor(customFilePath?: string, customSeed?: string) {
    const secretSeed =
      customSeed ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.JWT_SECRET ||
      'provador-virtual-vault-master-seed-2026';

    this.masterKey = crypto.createHash('sha256').update(secretSeed).digest();
    this.filePath = customFilePath || path.resolve(process.cwd(), 'data', '.secrets_vault.enc');

    this.loadFromDisk();
  }

  private mask(secret: string): string {
    if (!secret || secret.length <= 4) {
      return '••••••••';
    }
    const last4 = secret.slice(-4);
    return `••••••••${last4}`;
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          this.vault = new Map(Object.entries(parsed));
          logger.info(`[SecretStore] Loaded ${this.vault.size} stored credential entries from disk.`);
        }
      }
      this.isLoaded = true;
    } catch (err) {
      logger.error('[SecretStore] Failed to load vault from disk', err);
      this.vault = new Map();
      this.isLoaded = true;
    }
  }

  private persistToDisk(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const obj: Record<string, SecretStoreEntry> = {};
      for (const [k, v] of this.vault.entries()) {
        obj[k] = v;
      }

      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      logger.error('[SecretStore] Failed to persist vault to disk', err);
    }
  }

  private encrypt(plaintext: string): { encryptedValue: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      encryptedValue: encrypted,
      iv: iv.toString('hex'),
      tag,
    };
  }

  private decrypt(entry: SecretStoreEntry): string | null {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.masterKey,
        Buffer.from(entry.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
      let decrypted = decipher.update(entry.encryptedValue, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      logger.error('[SecretStore] Decryption failed for vault entry', err);
      return null;
    }
  }

  public async setSecret(storeId: string, providerId: string, secret: string): Promise<{ masked: string }> {
    const trimmed = secret.trim();
    const { encryptedValue, iv, tag } = this.encrypt(trimmed);
    const masked = this.mask(trimmed);

    const entry: SecretStoreEntry = {
      encryptedValue,
      iv,
      tag,
      masked,
      updatedAt: new Date().toISOString(),
    };

    const key = `${storeId}:${providerId}`;
    this.vault.set(key, entry);
    this.persistToDisk();

    return { masked };
  }

  public async getSecret(storeId: string, providerId: string): Promise<string | null> {
    const key = `${storeId}:${providerId}`;
    const entry = this.vault.get(key);
    if (!entry) {
      return null;
    }
    return this.decrypt(entry);
  }

  public async deleteSecret(storeId: string, providerId: string): Promise<boolean> {
    const key = `${storeId}:${providerId}`;
    const existed = this.vault.delete(key);
    if (existed) {
      this.persistToDisk();
    }
    return existed;
  }

  public async hasSecret(storeId: string, providerId: string): Promise<boolean> {
    const key = `${storeId}:${providerId}`;
    return this.vault.has(key);
  }

  public async getMasked(storeId: string, providerId: string): Promise<string | null> {
    const key = `${storeId}:${providerId}`;
    const entry = this.vault.get(key);
    return entry ? entry.masked : null;
  }

  public async getEntry(storeId: string, providerId: string): Promise<SecretStoreEntry | null> {
    const key = `${storeId}:${providerId}`;
    return this.vault.get(key) || null;
  }

  public async recordTestResult(
    storeId: string,
    providerId: string,
    status: 'success' | 'failed',
    message?: string
  ): Promise<void> {
    const key = `${storeId}:${providerId}`;
    const entry = this.vault.get(key);
    if (entry) {
      entry.lastTest = {
        status,
        testedAt: new Date().toISOString(),
        message,
      };
      this.persistToDisk();
    }
  }

  public async listStoreSecrets(storeId: string): Promise<Record<string, { configured: boolean; masked: string | null; lastTest?: any }>> {
    const result: Record<string, { configured: boolean; masked: string | null; lastTest?: any }> = {};
    const prefix = `${storeId}:`;

    for (const [k, v] of this.vault.entries()) {
      if (k.startsWith(prefix)) {
        const providerId = k.substring(prefix.length);
        result[providerId] = {
          configured: true,
          masked: v.masked,
          lastTest: v.lastTest,
        };
      }
    }

    return result;
  }
}
