// server/providers/types.ts

export type GarmentCategoryType = 'auto' | 'full_body' | 'upper_body' | 'lower_body' | 'shoes';

export interface TryOnInput {
  personImage: string; // Base64 data URI or HTTP(S) URL
  garmentImage: string; // Base64 data URI or HTTP(S) URL
  garmentCategory: GarmentCategoryType;
  storeId?: string;
  userId?: string;
  productId?: string;
}

export type ProviderStatusCode = 'success' | 'failed' | 'timeout' | 'error';

export interface ProviderResult {
  provider: 'perfectcorp' | 'google';
  status: ProviderStatusCode;
  image: string | null;
  taskId: string | null;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
  details?: Record<string, any>;
}

export interface TryOnProvider {
  readonly providerName: 'perfectcorp' | 'google';
  generateTryOn(input: TryOnInput): Promise<ProviderResult>;
}

export type StoreProviderMode = 'perfectcorp' | 'google' | 'both';

export interface MultiProviderResult {
  mode: StoreProviderMode;
  status: 'success' | 'partial_success' | 'failed';
  results: {
    perfectcorp?: ProviderResult;
    google?: ProviderResult;
  };
  generationId?: string;
}
