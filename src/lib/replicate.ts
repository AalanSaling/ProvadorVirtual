// src/lib/replicate.ts
import { requestVirtualTryOn } from '../services/vtonService';
import { GarmentCategory, ProviderType } from '../types';

export interface VtonApiPayload {
  personImage: string;
  garmentImage: string;
  category: GarmentCategory;
  provider?: ProviderType;
  storeId?: string;
  productId?: string;
}

export async function processVirtualTryOn(payload: VtonApiPayload) {
  return requestVirtualTryOn({
    personImage: payload.personImage,
    garmentImage: payload.garmentImage,
    garmentCategory: payload.category,
    requestedProvider: payload.provider,
    storeId: payload.storeId,
    productId: payload.productId,
  });
}
