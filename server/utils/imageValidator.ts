// server/utils/imageValidator.ts
import crypto from 'node:crypto';
import { GarmentCategory, ImageValidationMetadata, TryOnSemanticValidation } from '../types/index.js';
import { logger } from './logger.js';

export interface ImageValidationOptions {
  label: string; // e.g. 'Pessoa' or 'Roupa'
  isPerson?: boolean; // If true, permissive validation without dimension blocking
  maxSizeBytes?: number; // Default 10 MB
  minWidth?: number; // Default 512 for garments
  minHeight?: number; // Default 384 for garments
  maxLongSide?: number; // Default 4096
}

export interface ImageValidationResult {
  valid: boolean;
  format: 'jpeg' | 'png' | 'webp' | 'unknown';
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  sha256: string;
  errorMessage: string | null;
}

export function parseImageBuffer(buffer: Buffer): { format: 'jpeg' | 'png' | 'webp' | 'unknown'; mimeType: string; width: number; height: number } {
  if (!buffer || buffer.length === 0) {
    return { format: 'unknown', mimeType: 'application/octet-stream', width: 0, height: 0 };
  }

  // 1. PNG
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { format: 'png', mimeType: 'image/png', width, height };
    }
    return { format: 'png', mimeType: 'image/png', width: 800, height: 1000 };
  }

  // 2. JPEG
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
    return { format: 'jpeg', mimeType: 'image/jpeg', width: 800, height: 1000 };
  }

  // 3. WebP ('RIFF' .... 'WEBP')
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    let width = 800;
    let height = 1000;
    try {
      // VP8 (lossy)
      if (buffer.length >= 30 && buffer.toString('ascii', 12, 16) === 'VP8 ') {
        const keyframe = (buffer[23] & 1) === 0;
        if (keyframe && buffer[26] === 0x9d && buffer[27] === 0x01 && buffer[28] === 0x2a) {
          width = buffer.readUInt16LE(26) & 0x3fff;
          height = buffer.readUInt16LE(28) & 0x3fff;
        }
      } else if (buffer.length >= 25 && buffer.toString('ascii', 12, 16) === 'VP8L') {
        // VP8L (lossless)
        const b1 = buffer[21];
        const b2 = buffer[22];
        const b3 = buffer[23];
        const b4 = buffer[24];
        width = 1 + (((b2 & 0x3f) << 8) | b1);
        height = 1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      } else if (buffer.length >= 30 && buffer.toString('ascii', 12, 16) === 'VP8X') {
        // VP8X (extended)
        width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
        height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      }
    } catch {
      // Keep defaults
    }
    return { format: 'webp', mimeType: 'image/webp', width, height };
  }

  // 4. GIF
  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    return { format: 'png', mimeType: 'image/gif', width: width || 800, height: height || 1000 };
  }

  return { format: 'unknown', mimeType: 'application/octet-stream', width: 0, height: 0 };
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export const computeImageBufferSha256 = computeSha256;

export async function getImageMetadata(
  imageInput: string
): Promise<{ width: number; height: number; format: string; mimeType: string; sizeBytes: number }> {
  try {
    if (!imageInput || typeof imageInput !== 'string' || imageInput.trim().length === 0) {
      return { width: 0, height: 0, format: 'unknown', mimeType: 'unknown', sizeBytes: 0 };
    }

    let buffer: Buffer | null = null;

    if (imageInput.startsWith('data:')) {
      const match = imageInput.match(/^data:([^;]+);base64,(.+)$/);
      if (match && match[2]) {
        buffer = Buffer.from(match[2], 'base64');
      } else {
        const commaIdx = imageInput.indexOf(',');
        if (commaIdx > -1) {
          buffer = Buffer.from(imageInput.substring(commaIdx + 1), 'base64');
        }
      }
    } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      const res = await fetch(imageInput);
      if (!res.ok) {
        return { width: 0, height: 0, format: 'unknown', mimeType: 'unknown', sizeBytes: 0 };
      }
      const arr = await res.arrayBuffer();
      buffer = Buffer.from(arr);
    } else {
      // Direct base64 string
      try {
        buffer = Buffer.from(imageInput, 'base64');
      } catch {
        buffer = null;
      }
    }

    if (!buffer || buffer.length === 0) {
      return { width: 0, height: 0, format: 'unknown', mimeType: 'unknown', sizeBytes: 0 };
    }

    const { format, mimeType, width, height } = parseImageBuffer(buffer);
    return {
      width: width || (format !== 'unknown' ? 800 : 0),
      height: height || (format !== 'unknown' ? 1000 : 0),
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
  const maxSizeBytes = options.maxSizeBytes ?? 10 * 1024 * 1024;
  const maxLongSide = options.maxLongSide ?? 4096;

  try {
    let buffer: Buffer;

    if (imageUrl.startsWith('data:')) {
      const commaIdx = imageUrl.indexOf(',');
      const base64Data = commaIdx > -1 ? imageUrl.substring(commaIdx + 1) : imageUrl;
      buffer = Buffer.from(base64Data, 'base64');
    } else {
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
      buffer = Buffer.from(arrayBuffer);
    }

    const sizeBytes = buffer.length;
    if (sizeBytes === 0) {
      return {
        valid: false,
        format: 'unknown',
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
        width: 0,
        height: 0,
        sha256: '',
        errorMessage: `Arquivo de imagem de ${options.label} está vazio (0 bytes).`,
      };
    }

    const sha256 = computeSha256(buffer);

    // 2. Validate max size
    if (sizeBytes > maxSizeBytes) {
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
      const limitMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
      return {
        valid: false,
        format: 'unknown',
        mimeType: 'application/octet-stream',
        sizeBytes,
        width: 0,
        height: 0,
        sha256,
        errorMessage: `Tamanho da imagem de ${options.label} (${sizeMB} MB) excede o limite máximo permitido de ${limitMB} MB.`,
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
        errorMessage: `Formato inválido para imagem de ${options.label}. Formatos suportados: JPEG, PNG, WEBP.`,
      };
    }

    // 4. Validate dimensions
    if (!options.isPerson && width > 0 && height > 0) {
      const minDim = Math.min(width, height);
      const maxDim = Math.max(width, height);

      // Min dimensions for GARMENT: 512x384 (min side >= 384, other side >= 512)
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
      width: width || 800,
      height: height || 1000,
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
      errorMessage: `Falha ao decodificar imagem de ${options.label}: ${err.message}`,
    };
  }
}

/**
 * Validates Person Input and Garment Input before calling any AI Provider.
 * Enforces:
 * 1. Person image valid (format, size, permissive dimensions)
 * 2. Garment image valid (format, size, strict dimensions)
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
  const personRes = await validateImageFromUrl(personImageUrl, { label: 'Pessoa (src_file_url)', isPerson: true });
  const garmentRes = await validateImageFromUrl(garmentImageUrl, { label: 'Roupa (ref_file_url)', isPerson: false });

  const personMetadata: ImageValidationMetadata = {
    type: 'image',
    format: personRes.format as any,
    mimeType: personRes.mimeType,
    width: personRes.width,
    height: personRes.height,
    sizeBytes: personRes.sizeBytes,
    sha256: personRes.sha256,
  };

  const garmentMetadata: ImageValidationMetadata = {
    type: 'image',
    format: garmentRes.format as any,
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

