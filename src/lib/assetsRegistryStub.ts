// src/lib/assetsRegistryStub.ts
export function registerAsset(asset: any) {
  return asset;
}

export function getAssetByID(assetId: any) {
  return assetId;
}

export default {
  registerAsset,
  getAssetByID,
};
