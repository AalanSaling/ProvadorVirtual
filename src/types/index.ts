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

export interface GarmentVisualAnalysis {
  hasModelOrPerson: boolean;
  hasMannequin: boolean;
  hasComplexBackground: boolean;
  hasMultipleGarments: boolean;
  isPartiallyHidden: boolean;
  isCropped: boolean;
  hasOverlappingClothing: boolean;
  hasBackgroundTextOrLogo: boolean;
  hasReflectionsOrHarshShadows: boolean;
  isSharp: boolean;
  garmentType: string;
  category: GarmentCategory;
  length?: string;
  sleeves?: string;
  neckline?: string;
  primaryColor: string;
  secondaryColors?: string[];
  pattern?: string;
  texture?: string;
  details?: string[];
  rawSummary?: string;
}

export interface GarmentQualityGateResult {
  passed: boolean;
  hasSingleGarment: boolean;
  modelRemoved: boolean;
  cleanBackground: boolean;
  minResolutionPassed: boolean;
  decodableFormat: boolean;
  colorPreserved: boolean;
  detailsPreserved: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export type GarmentPreparationStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'not_configured';

export interface GarmentPreparationMetadata {
  status: GarmentPreparationStatus;
  version: string;
  model: string;
  originalImageUrl: string;
  preparedImageUrl: string | null;
  analysis: GarmentVisualAnalysis | null;
  qualityGate: GarmentQualityGateResult | null;
  updatedAt: string;
}

export interface PersonQualityCheckResult {
  valid: boolean;
  isSharp: boolean;
  isSinglePerson: boolean;
  framing: 'full_body' | 'upper_body' | 'too_close' | 'too_far' | 'unknown';
  faceVisible: boolean;
  lightingAdequate: boolean;
  poseAdequate: boolean;
  humanMessage: string;
  errorCode?: string | null;
}
