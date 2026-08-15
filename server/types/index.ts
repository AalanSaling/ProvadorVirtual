// server/types/index.ts
import { Request } from 'express';

export type GarmentCategory = 'upper_body' | 'lower_body' | 'full_body' | 'shoes';
export type CurrencyCode = 'BRL' | 'PYG' | 'USD' | 'EUR';
export type StoreRole = 'owner' | 'manager';

export interface ProviderCapabilities {
  upperBody: boolean;
  lowerBody: boolean;
  fullBody: boolean;
  shoes: boolean;
}

export interface TryOnInput {
  personImage: string; // URL or Data URI of person photo (Main subject)
  garmentImage: string; // URL of garment photo
  garmentCategory: GarmentCategory;
  productId?: string;
  storeId: string;
  userId: string;
}

export interface TryOnResult {
  provider: string; // e.g. 'perfectcorp', 'google'
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

export interface StoreProviderConfig {
  storeId: string;
  enabledProviders: string[];
  defaultProvider?: string | null;
}

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

export interface UserSession {
  id: string;
  email?: string;
}

export interface ImageValidationMetadata {
  type: 'image';
  format: 'jpeg' | 'png' | 'unknown';
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  sha256: string;
}

export interface TryOnSemanticValidation {
  valid: boolean;
  person: ImageValidationMetadata;
  garment: ImageValidationMetadata;
  semanticMapping: {
    src_file_url: 'PERSON';
    ref_file_url: 'GARMENT';
  };
  category: GarmentCategory;
  differentImages: boolean;
  differentHashes: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface GarmentPreparationResult {
  status: 'prepared' | 'existing_reference' | 'segmentation_not_implemented';
  referenceUrl: string;
  segmentationEngine: string | null;
  isCleanedGarment: boolean;
  errorCode?: string | null;
  message?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserSession;
  storeRole?: StoreRole;
}
