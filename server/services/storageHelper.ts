// server/services/storageHelper.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Ensures required storage buckets exist:
 * - product-images (PUBLIC)
 * - try-on-inputs (PRIVATE)
 * - try-on-results (PRIVATE)
 */
export async function ensureStorageBucketsExist(): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const existing = new Set(buckets?.map((b) => b.name) || []);

    if (!existing.has('product-images')) {
      await supabase.storage.createBucket('product-images', { public: true });
    }
    if (!existing.has('try-on-inputs')) {
      await supabase.storage.createBucket('try-on-inputs', { public: false });
    }
    if (!existing.has('try-on-results')) {
      await supabase.storage.createBucket('try-on-results', { public: false });
    }
  } catch (err) {
    console.warn('[STORAGE] Warning checking storage buckets:', err);
  }
}

/**
 * Validates, uploads person photo to private bucket 'try-on-inputs', and returns temporary Signed URL.
 */
export async function uploadPersonImageAndGetSignedUrl(
  personImage: string,
  userId: string = 'anon'
): Promise<{ signedUrl: string; storagePath: string }> {
  const supabase = getSupabaseAdmin();

  // If already an accessible HTTP/HTTPS URL
  if (personImage.startsWith('http://') || personImage.startsWith('https://')) {
    return { signedUrl: personImage, storagePath: '' };
  }

  if (!personImage.startsWith('data:')) {
    throw new Error('Foto da pessoa deve ser uma Data URI Base64 ou URL HTTP(S) válida.');
  }

  const match = personImage.match(/^data:(image\/(jpeg|png|jpg|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error('Foto da pessoa possui formato Base64 inválido. Utilize JPEG, PNG ou WEBP.');
  }

  const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const ext = mimeType.split('/')[1] || 'jpg';
  const base64Data = match[3];

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('Foto da pessoa excede o tamanho máximo permitido de 10 MB.');
  }

  const storagePath = `temp-inputs/person-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

  if (!supabase) {
    throw new Error('Supabase admin não configurado para upload de imagem.');
  }

  const { error: uploadErr } = await supabase.storage
    .from('try-on-inputs')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (uploadErr) {
    throw new Error(`Falha ao salvar foto temporária no Storage privado: ${uploadErr.message}`);
  }

  // Generate 15-minute signed URL
  const { data: signedData, error: signedErr } = await supabase.storage
    .from('try-on-inputs')
    .createSignedUrl(storagePath, 900);

  if (signedErr || !signedData?.signedUrl) {
    throw new Error(`Falha ao gerar URL temporária para o provedor de IA: ${signedErr?.message}`);
  }

  return { signedUrl: signedData.signedUrl, storagePath };
}

/**
 * Prepares garment image and returns an accessible URL for provider.
 */
export async function prepareGarmentImageForProvider(
  garmentImage: string,
  productId?: string
): Promise<{ url: string; storagePath: string }> {
  if (garmentImage.startsWith('http://') || garmentImage.startsWith('https://')) {
    return { url: garmentImage, storagePath: '' };
  }

  if (!garmentImage.startsWith('data:')) {
    throw new Error('Foto da roupa deve ser uma Data URI Base64 ou URL HTTP(S) válida.');
  }

  const supabase = getSupabaseAdmin();
  const match = garmentImage.match(/^data:(image\/(jpeg|png|jpg|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error('Foto da roupa possui formato Base64 inválido. Utilize JPEG, PNG ou WEBP.');
  }

  const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const ext = mimeType.split('/')[1] || 'png';
  const base64Data = match[3];
  const buffer = Buffer.from(base64Data, 'base64');

  const storagePath = `garments/garment-${productId || 'custom'}-${Date.now()}.${ext}`;

  if (!supabase) {
    return { url: garmentImage, storagePath: '' };
  }

  const { error: uploadErr } = await supabase.storage
    .from('product-images')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (uploadErr) {
    // Fallback to try-on-inputs
    const { error: inputUploadErr } = await supabase.storage
      .from('try-on-inputs')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (inputUploadErr) throw new Error(`Falha ao enviar foto da roupa: ${inputUploadErr.message}`);

    const { data: signedData } = await supabase.storage.from('try-on-inputs').createSignedUrl(storagePath, 900);
    return { url: signedData?.signedUrl || garmentImage, storagePath };
  }

  const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(storagePath);
  return { url: pubData.publicUrl, storagePath };
}

/**
 * Downloads/saves result image from Provider into private bucket 'try-on-results' and returns signed URL.
 */
export async function saveResultToPrivateStorage(
  imageInput: string,
  userId: string = 'anon'
): Promise<{ signedUrl: string; storagePath: string }> {
  const supabase = getSupabaseAdmin();
  let buffer: Buffer;
  let mimeType = 'image/png';
  let ext = 'png';

  if (imageInput.startsWith('data:')) {
    const match = imageInput.match(/^data:(image\/(jpeg|png|jpg|webp));base64,(.+)$/i);
    if (match) {
      mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
      ext = mimeType.split('/')[1] || 'png';
      buffer = Buffer.from(match[3], 'base64');
    } else {
      buffer = Buffer.from(imageInput.split(',')[1] || imageInput, 'base64');
    }
  } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
    const resp = await fetch(imageInput);
    if (!resp.ok) {
      throw new Error(`Falha ao carregar imagem de resultado do provedor (HTTP ${resp.status}).`);
    }
    const contentType = resp.headers.get('content-type');
    if (contentType) {
      mimeType = contentType.split(';')[0];
      ext = mimeType.split('/')[1] || 'png';
    }
    const arrayBuffer = await resp.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else {
    return { signedUrl: imageInput, storagePath: '' };
  }

  const storagePath = `results/result-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

  if (!supabase) {
    return { signedUrl: imageInput, storagePath: '' };
  }

  const { error: uploadErr } = await supabase.storage
    .from('try-on-results')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (uploadErr) {
    console.warn('[STORAGE] Não foi possível salvar resultado em try-on-results:', uploadErr.message);
    return { signedUrl: imageInput, storagePath: '' };
  }

  // Signed URL valid for 7 days
  const { data: signedData, error: signedErr } = await supabase.storage
    .from('try-on-results')
    .createSignedUrl(storagePath, 604800);

  if (signedErr || !signedData?.signedUrl) {
    return { signedUrl: imageInput, storagePath };
  }

  return { signedUrl: signedData.signedUrl, storagePath };
}

/**
 * Immediately deletes temporary input photos after generation (Privacy Requirement)
 */
export async function cleanupTempInputPhoto(storagePath: string): Promise<void> {
  if (!storagePath) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    await supabase.storage.from('try-on-inputs').remove([storagePath]);
  } catch (err) {
    console.warn('[STORAGE] Erro ao limpar foto temporária:', storagePath, err);
  }
}
