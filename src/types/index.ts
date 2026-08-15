// src/types/index.ts

export type GarmentCategory = 'upper_body' | 'lower_body' | 'full_body' | 'shoes';
export type CurrencyCode = 'BRL' | 'PYG' | 'USD' | 'EUR';

export interface ProductPhoto {
  id?: string;
  productId?: string;
  type: 'catalog' | 'try_on_reference';
  storagePath: string;
  sortOrder?: number;
}

export interface Product {
  id?: string;
  storeId: string;
  name: string;
  description?: string;
  category: GarmentCategory;
  garmentType?: string;
  color?: string;
  material?: string;
  fit?: string;
  price: number;
  currency: CurrencyCode;
  sizes: string[];
  stock: number;
  active?: boolean;
  photos?: ProductPhoto[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TryOnResult {
  provider: string;
  status: 'success' | 'failed' | 'timeout' | 'error';
  resultImage: string | null;
  providerTaskId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number;
}

export interface MultiProviderTryOnResponse {
  overallStatus: 'success' | 'partial_success' | 'failed';
  selectedProviders: string[];
  results: TryOnResult[];
  storeId: string;
  timestamp: string;
}

export interface StoreAIConfig {
  storeId: string;
  enabledProviders: string[];
  defaultProvider?: string | null;
}
