// src/services/vtonService.ts
import { GarmentCategory, ProviderType } from '../types';

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
}

export function mapGarmentCategory(productCategory: string): GarmentCategory {
  const cat = productCategory.toLowerCase();
  if (cat.includes('vestido') || cat.includes('saia') || cat.includes('dress') || cat.includes('conjunto')) {
    return 'full_body';
  }
  if (cat.includes('calça') || cat.includes('shorts') || cat.includes('bermuda') || cat.includes('pants')) {
    return 'lower_body';
  }
  if (cat.includes('sapato') || cat.includes('tênis') || cat.includes('shoes')) {
    return 'shoes';
  }
  return 'upper_body';
}

export interface TryOnSingleResult {
  provider: 'perfectcorp' | 'google';
  status: 'success' | 'failed' | 'timeout' | 'error';
  image: string | null;
  taskId?: string | null;
  latencyMs?: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface TryOnApiResponse {
  mode: ProviderType;
  status: 'success' | 'partial_success' | 'failed';
  results: {
    perfectcorp?: TryOnSingleResult;
    google?: TryOnSingleResult;
  };
  generationId?: string;
  error?: string;
}

/**
  * Calls real Virtual Try-On backend service.
  * ABSOLUTELY NO local canvas overlay or fake composition is performed.
  */
export async function requestVirtualTryOn(payload: {
  personImage: string;
  garmentImage: string;
  garmentCategory: GarmentCategory;
  storeId?: string;
  userId?: string;
  productId?: string;
  requestedProvider?: ProviderType;
  onStatusChange?: (statusMessage: string) => void;
}): Promise<TryOnApiResponse> {
  if (payload.onStatusChange) payload.onStatusChange('Preparando sua foto...');
  await new Promise((r) => setTimeout(r, 300));

  if (payload.onStatusChange) payload.onStatusChange('Enviando para o provedor...');
  await new Promise((r) => setTimeout(r, 300));

  if (payload.onStatusChange) payload.onStatusChange('Gerando provador virtual...');

  const response = await fetch('/api/try-on/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      person_image: payload.personImage,
      garment_image: payload.garmentImage,
      garment_category: payload.garmentCategory,
      store_id: payload.storeId || 'demo-store-001',
      user_id: payload.userId,
      product_id: payload.productId,
      requested_provider: payload.requestedProvider,
    }),
  });

  if (payload.onStatusChange) payload.onStatusChange('Finalizando imagem...');

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error || errJson.details || 'Não foi possível gerar o provador virtual.');
  }

  const data: TryOnApiResponse = await response.json();
  return data;
}

/**
  * Admin: Fetch Store AI Engine configuration
  */
export async function getStoreAiSettings(storeId: string): Promise<{ provider_mode: ProviderType }> {
  try {
    const res = await fetch(`/api/admin/store-ai-settings/${storeId}`);
    if (!res.ok) return { provider_mode: 'both' };
    return await res.json();
  } catch {
    return { provider_mode: 'both' };
  }
}

/**
  * Admin: Save Store AI Engine configuration
  */
export async function saveStoreAiSettings(storeId: string, providerMode: ProviderType): Promise<boolean> {
  const res = await fetch('/api/admin/store-ai-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: storeId, provider_mode: providerMode }),
  });
  return res.ok;
}

/**
  * Admin: Run single provider diagnostic test
  */
export async function testProviderDiagnostic(payload: {
  provider: 'perfectcorp' | 'google';
  personImage?: string;
  garmentImage?: string;
  garmentCategory?: string;
}): Promise<{
  provider: string;
  request_accepted: boolean;
  processing: boolean;
  completed: boolean;
  status: string;
  latency_ms: number;
  error_code: string | null;
  error_message: string | null;
  result_url: string | null;
}> {
  const res = await fetch('/api/admin/test-provider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro no teste de diagnóstico do provedor.');
  }
  return await res.json();
}

/**
  * Admin: Run complete test suite (15 test cases)
  */
export async function runVtonTests(): Promise<any> {
  const res = await fetch('/api/admin/run-tests');
  if (!res.ok) throw new Error('Falha ao executar bateria de testes.');
  return await res.json();
}
