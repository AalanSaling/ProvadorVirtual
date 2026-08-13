// src/types/index.ts

export type TabType = 'provador' | 'catalog' | 'settings';

export type GarmentCategory = 'upper_body' | 'lower_body' | 'full_body' | 'shoes' | 'accessories' | 'other';

export type ProviderType = 'perfectcorp' | 'google' | 'both';

export type Currency = 'BRL' | 'PYG' | 'USD' | 'EUR';

export type StoreRole = 'owner' | 'manager';

export type GenerationStatus = 'idle' | 'uploading' | 'queued' | 'processing' | 'success' | 'partial_success' | 'failed' | 'error';

export interface Store {
  id: string;
  name: string;
  slug: string;
  created_at?: string;
  updated_at?: string;
}

export interface StoreMember {
  id: string;
  store_id: string;
  user_id: string;
  role: StoreRole;
  created_at?: string;
}

export interface StoreAISettings {
  store_id: string;
  provider_mode: ProviderType;
  enabled: boolean;
  updated_at?: string;
}

export interface ClothingItem {
  id: string;
  store_id: string;
  name: string;
  description: string;
  category: string;
  garment_type?: string;
  color?: string;
  material?: string;
  fit?: string;
  price: number;
  currency: Currency;
  sizes: string[];
  stock: number;
  active: boolean;
  image: string; // Imagem do catálogo
  try_on_reference_image?: string; // Imagem de referência para IA / Try-On
  created_at?: string;
  updated_at?: string;
}

export interface ProductInput {
  store_id: string;
  name: string;
  description: string;
  category: string;
  garment_type?: string;
  color?: string;
  material?: string;
  fit?: string;
  price: number;
  currency: Currency;
  sizes: string[];
  stock: number;
  active: boolean;
  image_url: string;
  try_on_reference_url?: string;
}

export interface SavedTryOn {
  id: string;
  timestamp: string;
  personImage: string;
  garmentImage: string;
  garmentName: string;
  resultImage: string;
}

export interface ProvadorState {
  personImage: string | null;
  selectedProduct: ClothingItem | null;
  selectedProvider: ProviderType;
  garmentCategory: GarmentCategory;
  generationStatus: GenerationStatus;
  generationResult: string | null;
  error: string | null;
}
