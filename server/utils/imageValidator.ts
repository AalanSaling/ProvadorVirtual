// server/utils/imageValidator.ts
import crypto from 'node:crypto';
import { GarmentCategory, ImageValidationMetadata, TryOnSemanticValidation } from '../types/index.js';
import { logger } from './logger.js';

export interface ImageValidationOptions {
  label: string; // e.g. 'Pessoa' or 'Roupa'
  maxSizeBytes?: number; // Default 10 MB
  minWidth?: number; // Default 512
  minHeight?: number; // Default 384
  maxLongSide?: number; // Default 4096
}

export interface ImageValidationResult {
  valid: boolean;
  format: 'jpeg' | 'png' | 'unknown';
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  sha256: string;
  errorMessage: string | null;
}

export function parseImageBuffer(buffer: Buffer): { format: 'jpeg' | 'png' | 'unknown'; mimeType: string; width: number; height: number } {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { format: 'png', mimeType: 'image/png', width, height };
    }
    return { format: 'png', mimeType: 'image/png', width: 0, height: 0 };
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // SOF markers: SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2), SOF3 (0xC3), SOF5 (0xC5), etc.
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { format: 'jpeg', mimeType: 'image/jpeg', width, height };
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += 2 + length;
    }
    return { format: 'jpeg', mimeType: 'image/jpeg', width: 0, height: 0 };
  }

  return { format: 'unknown', mimeType: 'application/octet-stream', width: 0, height: 0 };
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function getImageMetadata(
  imageInput: string
): Promise<{ width: number; height: number; format: string; mimeType: string; sizeBytes: number }> {
  try {
    let buffer: Buffer;
    if (imageInput.startsWith('data:')) {
      const match = imageInput.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return { width: 0, height: 0, format: 'unknown', mimeType: 'unknown', sizeBytes: 0 };
      }
      buffer = Buffer.from(match[2], 'base64');
    } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      const res = await fetch(imageInput);
      if (!res.ok) {
        return { width: 0, height: 0, format: 'unknown', mimeType: 'unknown', sizeBytes: 0 };
      }
      const arr = await res.arrayBuffer();
      buffer = Buffer.from(arr);
    } else {
      buffer = Buffer.from(imageInput, 'base64');
    }

    const { format, mimeType, width, height } = parseImageBuffer(buffer);
    return {
      width,
      height,
      format,
      mimeType,
      sizeBytes: buffer.length,
    };
  } catch {
    return { width: 0, height: 0, format: 'unknown', mimeType: 'unknown', sizeBytes: 0 };
  }
}

export async function validateImageFromUrl(
  imageUrl: string,
  options: ImageValidationOptions
): Promise<ImageValidationResult> {
  const maxSizeBytes = options.maxSizeBytes ?? 10 * 1024 * 1024; // 10 MB
  const maxLongSide = options.maxLongSide ?? 4096;

  try {
    // 1. Fetch image buffer
    const res = await fetch(imageUrl, { method: 'GET' });
    if (!res.ok) {
      return {
        valid: false,
        format: 'unknown',
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
        width: 0,
        height: 0,
        sha256: '',
        errorMessage: `Imagem de ${options.label} não está acessível no URL fornecido (HTTP ${res.status}).`,
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sizeBytes = buffer.length;
    const sha256 = computeSha256(buffer);

    // 2. Validate max size (10 MB)
    if (sizeBytes > maxSizeBytes) {
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        format: 'unknown',
        mimeType: 'application/octet-stream',
        sizeBytes,
        width: 0,
        height: 0,
        sha256,
        errorMessage: `Tamanho da imagem de ${options.label} (${sizeMB} MB) excede o limite máximo permitido de 10 MB.`,
      };
    }

    // 3. Parse format and dimensions
    const { format, mimeType, width, height } = parseImageBuffer(buffer);

    if (format === 'unknown') {
      return {
        valid: false,
        format: 'unknown',
        mimeType,
        sizeBytes,
        width,
        height,
        sha256,
        errorMessage: `Formato inválido para imagem de ${options.label}. Apenas JPEG e PNG são aceitos.`,
      };
    }

    // 4. Validate dimensions
    if (width > 0 && height > 0) {
      const minDim = Math.min(width, height);
      const maxDim = Math.max(width, height);

      // Min dimensions: 512x384 (min side >= 384, other side >= 512)
      if (minDim < 384 || maxDim < 512) {
        return {
          valid: false,
          format,
          mimeType,
          sizeBytes,
          width,
          height,
          sha256,
          errorMessage: `Dimensões da imagem de ${options.label} (${width}x${height}px) são inferiores ao mínimo exigido (512x384px).`,
        };
      }

      // Max long side: 4096 px
      if (maxDim > maxLongSide) {
        return {
          valid: false,
          format,
          mimeType,
          sizeBytes,
          width,
          height,
          sha256,
          errorMessage: `Lado maior da imagem de ${options.label} (${maxDim}px) excede o limite máximo de ${maxLongSide}px.`,
        };
      }
    }

    return {
      valid: true,
      format,
      mimeType,
      sizeBytes,
      width,
      height,
      sha256,
      errorMessage: null,
    };
  } catch (err: any) {
    return {
      valid: false,
      format: 'unknown',
      mimeType: 'application/octet-stream',
      sizeBytes: 0,
      width: 0,
      height: 0,
      sha256: '',
      errorMessage: `Falha ao baixar/validar imagem de ${options.label}: ${err.message}`,
    };
  }
}

/**
 * Validates Person Input and Garment Input before calling any AI Provider.
 * Enforces:
 * 1. Person image valid (format, size, dimensions)
 * 2. Garment image valid (format, size, dimensions)
 * 3. Person != Garment (URL inequality)
 * 4. Person SHA-256 != Garment SHA-256 (Binary hash collision detection)
 * 5. Strict semantic mapping: src_file_url = PERSON, ref_file_url = GARMENT
 * 6. Structured semantic logging without sensitive tokens
 */
export async function validateTryOnSemanticInput(
  personImageUrl: string,
  garmentImageUrl: string,
  category: GarmentCategory
): Promise<TryOnSemanticValidation> {
  const personRes = await validateImageFromUrl(personImageUrl, { label: 'Pessoa (src_file_url)' });
  const garmentRes = await validateImageFromUrl(garmentImageUrl, { label: 'Roupa (ref_file_url)' });

  const personMetadata: ImageValidationMetadata = {
    type: 'image',
    format: personRes.format,
    mimeType: personRes.mimeType,
    width: personRes.width,
    height: personRes.height,
    sizeBytes: personRes.sizeBytes,
    sha256: personRes.sha256,
  };

  const garmentMetadata: ImageValidationMetadata = {
    type: 'image',
    format: garmentRes.format,
    mimeType: garmentRes.mimeType,
    width: garmentRes.width,
    height: garmentRes.height,
    sizeBytes: garmentRes.sizeBytes,
    sha256: garmentRes.sha256,
  };

  const differentImages = personImageUrl.trim() !== garmentImageUrl.trim();
  const differentHashes = personRes.sha256 !== '' && garmentRes.sha256 !== '' && personRes.sha256 !== garmentRes.sha256;

  // Semantic Log as mandated in Requirement 9
  logger.info(
    `[TRY_ON_INPUT_VALIDATION]\n` +
    `person:\n` +
    `  type=image\n` +
    `  mime=${personMetadata.mimeType}\n` +
    `  width=${personMetadata.width}\n` +
    `  height=${personMetadata.height}\n` +
    `  bytes=${personMetadata.sizeBytes}\n` +
    `  sha256=${personMetadata.sha256}\n` +
    `garment:\n` +
    `  type=image\n` +
    `  mime=${garmentMetadata.mimeType}\n` +
    `  width=${garmentMetadata.width}\n` +
    `  height=${garmentMetadata.height}\n` +
    `  bytes=${garmentMetadata.sizeBytes}\n` +
    `  sha256=${garmentMetadata.sha256}\n` +
    `semantic mapping:\n` +
    `  src_file_url = PERSON\n` +
    `  ref_file_url = GARMENT\n` +
    `category=${category}\n` +
    `different_images=${differentImages}\n` +
    `different_hashes=${differentHashes}`
  );

  if (!personRes.valid) {
    return {
      valid: false,
      person: personMetadata,
      garment: garmentMetadata,
      semanticMapping: {
        src_file_url: 'PERSON',
        ref_file_url: 'GARMENT',
      },
      category,
      differentImages,
      differentHashes,
      errorCode: 'INVALID_PERSON_IMAGE',
      errorMessage: personRes.errorMessage || 'Invalid person image.',
    };
  }

  if (!garmentRes.valid) {
    return {
      valid: false,
      person: personMetadata,
      garment: garmentMetadata,
      semanticMapping: {
        src_file_url: 'PERSON',
        ref_file_url: 'GARMENT',
      },
      category,
      differentImages,
      differentHashes,
      errorCode: 'INVALID_GARMENT_IMAGE',
      errorMessage: garmentRes.errorMessage || 'Invalid garment image.',
    };
  }

  if (!differentImages || !differentHashes) {
    const collisionMsg = !differentImages
      ? 'Semantic collision: Person image URL is identical to Garment image URL.'
      : 'Semantic collision: Person image content hash (SHA-256) is identical to Garment image content hash.';
    
    logger.error(`[TRY_ON_INPUT_VALIDATION] Failed semantic check: ${collisionMsg}`);

    return {
      valid: false,
      person: personMetadata,
      garment: garmentMetadata,
      semanticMapping: {
        src_file_url: 'PERSON',
        ref_file_url: 'GARMENT',
      },
      category,
      differentImages,
      differentHashes,
      errorCode: 'SEMANTIC_COLLISION_PERSON_EQUALS_GARMENT',
      errorMessage: collisionMsg,
    };
  }

  return {
    valid: true,
    person: personMetadata,
    garment: garmentMetadata,
    semanticMapping: {
      src_file_url: 'PERSON',
      ref_file_url: 'GARMENT',
    },
    category,
    differentImages: true,
    differentHashes: true,
    errorCode: null,
    errorMessage: null,
  };
}
