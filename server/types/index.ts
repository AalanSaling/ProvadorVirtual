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

export interface ExecutionContext {
  storeId: string;
  providerId: string;
  storeApiKey: string;
  userId?: string;
  productId?: string;
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
  status: 'prepared' | 'existing_reference' | 'segmentation_not_implemented' | 'failed';
  referenceUrl: string | null;
  segmentationEngine: string | null;
  isCleanedGarment: boolean;
  errorCode?: string | null;
  message?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserSession;
  storeRole?: StoreRole;
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

export interface PersonTryOnContext {
  subject: 'single_person';
  identityPreservation: 'exact';
  posePreservation: 'exact';
  facePreservation: 'exact';
  bodyProportionsPreservation: 'exact';
  hairPreservation: 'exact';
  lightingPreservation: 'coherent';
  backgroundPreservation: 'coherent';
  clothingReplacement: 'only_selected_garment';
}

export interface GarmentTryOnContext {
  category: GarmentCategory;
  garmentType?: string;
  primaryColor?: string;
  pattern?: string;
  sleeves?: string;
  neckline?: string;
  texture?: string;
  keyDetails?: string[];
}
