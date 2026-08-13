export type TabType = 'provador' | 'catalog' | 'settings';

export type GarmentCategory = 'upper_body' | 'lower_body' | 'full_body';

export interface ClothingItem {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  sizes?: string[];
  stock?: number;
  created_at?: string;
}

export interface ProductInput {
  name: string;
  description: string;
  category: string;
  price: number;
  sizes: string[];
  image_url: string;
  stock: number;
}

export interface VtonResult {
  status: 'success' | 'error' | 'processing';
  output?: string;
  error?: string;
}

export interface SavedTryOn {
  id: string;
  timestamp: string;
  personImage: string;
  garmentImage: string;
  garmentName: string;
  resultImage: string;
}
