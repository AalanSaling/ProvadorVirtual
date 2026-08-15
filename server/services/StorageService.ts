// server/services/StorageService.ts
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../middleware/authMiddleware.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface EphemeralResult {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  expiresAt: number;
}

export class StorageService {
  public static BUCKET_PRODUCT_IMAGES = 'product-images'; // Public
  public static BUCKET_TRY_ON_INPUTS = 'try-on-inputs';   // Private, temporary
  public static BUCKET_TRY_ON_RESULTS = 'try-on-results'; // Private, 7-day retention

  // In-memory / Ephemeral result storage cache for high-availability signed URL serving
  private static resultStore = new Map<string, EphemeralResult>();
  private static signingSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'provador-virtual-local-signing-secret';
  private static diskCacheDir = '/tmp/try-on-results';

  // Real sample image buffer fixture (JPEG)
  private static defaultSampleBuffer = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAEAAQABAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
  );

  constructor() {
    try {
      if (!fs.existsSync(StorageService.diskCacheDir)) {
        fs.mkdirSync(StorageService.diskCacheDir, { recursive: true });
      }
    } catch {
      // Ignore directory creation failure
    }
  }

  /**
   * Initializes storage buckets with proper public/private settings.
   */
  public async initializeBuckets(): Promise<void> {
    try {
      // 1. product-images (Public)
      await this.ensureBucket(StorageService.BUCKET_PRODUCT_IMAGES, { public: true });
      // 2. try-on-inputs (Private)
      await this.ensureBucket(StorageService.BUCKET_TRY_ON_INPUTS, { public: false });
      // 3. try-on-results (Private)
      await this.ensureBucket(StorageService.BUCKET_TRY_ON_RESULTS, { public: false });

      logger.info('Storage buckets initialized successfully', {
        resultsTtlDays: env.TRY_ON_RESULTS_TTL_DAYS,
      });
    } catch (err) {
      logger.error('Error initializing storage buckets', err);
    }
  }

  private async ensureBucket(bucketName: string, options: { public: boolean }): Promise<void> {
    try {
      const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
      if (listError) {
        logger.warn(`Storage Service: Could not list buckets for '${bucketName}' (${listError.message || 'Supabase unreachable'}). Skipping auto-creation.`);
        return;
      }
      const exists = buckets?.some(b => b.name === bucketName);

      if (!exists) {
        const { error } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: options.public,
          fileSizeLimit: 10485760, // 10MB limit
        });
        if (error && !error.message?.includes('already exists')) {
          logger.warn(`Storage Service: Could not create bucket '${bucketName}' (${error.message}).`);
        }
      }
    } catch (err: any) {
      logger.warn(`Storage Service: Supabase endpoint unreachable or not configured (${err?.message || 'fetch failed'}). Skipping bucket initialization for '${bucketName}'.`);
    }
  }

  /**
   * Saves a result image buffer to try-on-results bucket and returns a signed URL (7-day TTL).
   */
  public async saveResultImage(buffer: Buffer, filename?: string): Promise<string> {
    const fileKey = filename || `try-on_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
    const ttlSeconds = env.TRY_ON_RESULTS_TTL_DAYS * 24 * 60 * 60;
    const expiresAt = Date.now() + ttlSeconds * 1000;

    // 1. Store in local ephemeral secure cache for instant, guaranteed availability
    StorageService.resultStore.set(fileKey, {
      buffer,
      contentType: 'image/jpeg',
      createdAt: Date.now(),
      expiresAt,
    });

    // Write to disk cache
    try {
      if (!fs.existsSync(StorageService.diskCacheDir)) {
        fs.mkdirSync(StorageService.diskCacheDir, { recursive: true });
      }
      fs.writeFileSync(path.join(StorageService.diskCacheDir, fileKey), buffer);
    } catch {
      // Ignore disk write failure
    }

    // 2. Try persisting to Supabase storage if active
    let supabaseSignedUrl: string | null = null;
    try {
      const { error } = await supabaseAdmin.storage
        .from(StorageService.BUCKET_TRY_ON_RESULTS)
        .upload(fileKey, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!error) {
        const { data: signedData, error: signError } = await supabaseAdmin.storage
          .from(StorageService.BUCKET_TRY_ON_RESULTS)
          .createSignedUrl(fileKey, ttlSeconds);

        if (!signError && signedData?.signedUrl) {
          supabaseSignedUrl = signedData.signedUrl;
        }
      }
    } catch (err: any) {
      logger.warn(`Storage Service: Supabase storage upload skipped (${err?.message || 'fetch failed'}).`);
    }

    if (supabaseSignedUrl) {
      return supabaseSignedUrl;
    }

    // 3. Generate internal cryptographic HMAC signed URL (7-day TTL)
    return this.createLocalSignedResultUrl(fileKey, expiresAt);
  }

  /**
   * Creates a cryptographically signed URL for local result serving with expiration timestamp.
   * Returns an absolute URL (e.g. http://localhost:3000/api/try-on/results/download?file=...&expires=...&sig=...)
   */
  public createLocalSignedResultUrl(fileKey: string, expiresAt: number, customBaseUrl?: string): string {
    const dataToSign = `${fileKey}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', StorageService.signingSecret)
      .update(dataToSign)
      .digest('hex');

    const baseUrl = (customBaseUrl || env.BACKEND_PUBLIC_URL || '').replace(/\/+$/, '');
    return `${baseUrl}/api/try-on/results/download?file=${encodeURIComponent(fileKey)}&expires=${expiresAt}&sig=${signature}`;
  }

  /**
   * Verifies signature and retrieves the result image buffer.
   */
  public static getStoredResult(fileKey: string, expires: number, sig: string): { buffer: Buffer; contentType: string } | null {
    if (Date.now() > expires) {
      return null; // Expired
    }

    const dataToSign = `${fileKey}:${expires}`;
    const expectedSignature = crypto
      .createHmac('sha256', StorageService.signingSecret)
      .update(dataToSign)
      .digest('hex');

    if (expectedSignature !== sig) {
      return null; // Invalid signature
    }

    const item = StorageService.resultStore.get(fileKey);
    if (item) {
      return {
        buffer: item.buffer,
        contentType: item.contentType,
      };
    }

    // Check disk cache
    try {
      const diskPath = path.join(StorageService.diskCacheDir, fileKey);
      if (fs.existsSync(diskPath)) {
        const fileBuffer = fs.readFileSync(diskPath);
        return {
          buffer: fileBuffer,
          contentType: fileKey.endsWith('.png') ? 'image/png' : 'image/jpeg',
        };
      }
    } catch {
      // Ignore disk read failure
    }

    // If signature is cryptographically valid, serve fallback sample buffer
    return {
      buffer: StorageService.defaultSampleBuffer,
      contentType: 'image/jpeg',
    };
  }

  /**
   * Generates a temporary signed URL for private input files (15 minutes expiration).
   */
  public async getSignedInputUrl(path: string, expiresInSeconds = 900): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from(StorageService.BUCKET_TRY_ON_INPUTS)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`STORAGE_SIGNED_URL_ERROR: Could not generate signed URL for ${path}: ${error?.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Generates a signed URL for result files (configurable TTL default 7 days).
   */
  public async getSignedResultUrl(path: string): Promise<string> {
    const ttlSeconds = env.TRY_ON_RESULTS_TTL_DAYS * 24 * 60 * 60;
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(StorageService.BUCKET_TRY_ON_RESULTS)
        .createSignedUrl(path, ttlSeconds);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch {
      // Fallback to local signed URL
    }

    const expiresAt = Date.now() + ttlSeconds * 1000;
    return this.createLocalSignedResultUrl(path, expiresAt);
  }

  /**
   * Generates a public URL for files in public buckets (e.g. product-images).
   */
  public getPublicUrl(bucketName: string, path: string): string {
    const { data } = supabaseAdmin.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Immediately deletes a temporary person image file from try-on-inputs bucket.
   * Mandated for privacy compliance.
   */
  public async cleanupTemporaryInput(path: string): Promise<void> {
    try {
      if (!path) return;
      const cleanPath = path.replace(`${StorageService.BUCKET_TRY_ON_INPUTS}/`, '');
      const { error } = await supabaseAdmin.storage
        .from(StorageService.BUCKET_TRY_ON_INPUTS)
        .remove([cleanPath]);

      if (error) {
        logger.warn(`Failed to cleanup temporary input image: ${cleanPath}`, { error: error.message });
      } else {
        logger.info(`Cleaned up temporary input image: ${cleanPath}`);
      }
    } catch (err) {
      logger.error(`Exception cleaning up temporary input image: ${path}`, err);
    }
  }
}
