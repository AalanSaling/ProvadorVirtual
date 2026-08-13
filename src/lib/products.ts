// src/lib/products.ts
import { ClothingItem, ProductInput, Store, StoreAISettings, StoreRole } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { getStoredCatalog, saveStoredCatalog } from './storage';

const DEFAULT_DEMO_STORE: Store = {
  id: 'demo-store-001',
  name: 'Loja Conceito VTON',
  slug: 'loja-conceito-vton',
};

/**
 * Obter a loja atual ou lista de lojas do usuário
 */
export async function getUserStores(): Promise<{ store: Store; role: StoreRole }[]> {
  if (!isSupabaseConfigured()) {
    return [{ store: DEFAULT_DEMO_STORE, role: 'owner' }];
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [{ store: DEFAULT_DEMO_STORE, role: 'owner' }];
  }

  const { data, error } = await supabase
    .from('store_members')
    .select('role, store_id, stores(id, name, slug)')
    .eq('user_id', user.id);

  if (error || !data || data.length === 0) {
    return [{ store: DEFAULT_DEMO_STORE, role: 'owner' }];
  }

  return data.map((item: any) => ({
    store: item.stores,
    role: item.role as StoreRole,
  }));
}

/**
 * Buscar produtos de uma loja do catálogo Supabase
 */
export async function getProducts(storeId: string = DEFAULT_DEMO_STORE.id): Promise<ClothingItem[]> {
  if (!isSupabaseConfigured()) {
    return await getStoredCatalog();
  }

  try {
    const { data: dbProducts, error } = await supabase
      .from('products')
      .select('*, product_photos(storage_path, type)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error || !dbProducts) {
      console.warn('Fallback para catálogo local ao buscar produtos:', error);
      return await getStoredCatalog();
    }

    return dbProducts.map((p: any) => {
      const catalogPhoto = p.product_photos?.find((ph: any) => ph.type === 'catalog')?.storage_path;
      const tryOnPhoto = p.product_photos?.find((ph: any) => ph.type === 'try_on_reference')?.storage_path;

      return {
        id: p.id,
        store_id: p.store_id,
        name: p.name,
        description: p.description || '',
        category: p.category,
        garment_type: p.garment_type,
        color: p.color,
        material: p.material,
        fit: p.fit,
        price: Number(p.price) || 0,
        currency: p.currency || 'BRL',
        sizes: p.sizes || ['P', 'M', 'G'],
        stock: p.stock ?? 10,
        active: p.active ?? true,
        image: catalogPhoto || p.image_url || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800',
        try_on_reference_image: tryOnPhoto || catalogPhoto || p.image_url,
        created_at: p.created_at,
        updated_at: p.updated_at,
      };
    });
  } catch (err) {
    console.error('Erro na busca de produtos:', err);
    return await getStoredCatalog();
  }
}

/**
 * Criar produto via Express API
 */
export async function createProduct(
  input: ProductInput,
  catalogBase64?: string,
  tryOnBase64?: string
): Promise<ClothingItem> {
  if (!isSupabaseConfigured()) {
    const newItem: ClothingItem = {
      id: Date.now().toString(),
      store_id: input.store_id || DEFAULT_DEMO_STORE.id,
      name: input.name,
      description: input.description,
      category: input.category,
      price: input.price,
      currency: input.currency || 'BRL',
      sizes: input.sizes,
      stock: input.stock,
      active: input.active ?? true,
      image: catalogBase64 || input.image_url,
      try_on_reference_image: tryOnBase64 || input.try_on_reference_url || catalogBase64 || input.image_url,
    };
    const catalog = await getStoredCatalog();
    const updated = [newItem, ...catalog];
    await saveStoredCatalog(updated);
    return newItem;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Usuário precisa estar autenticado para criar produtos.');
  }

  const response = await fetch('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      store_id: input.store_id || DEFAULT_DEMO_STORE.id,
      ...input,
      catalogImageBase64: catalogBase64,
      tryOnImageBase64: tryOnBase64,
    }),
  });

  const resJson = await response.json();
  if (!response.ok) {
    throw new Error(resJson.error || 'Erro ao criar produto.');
  }

  return resJson.product;
}

/**
 * Atualizar produto via Express API
 */
export async function updateProduct(
  input: ProductInput & { id: string },
  catalogBase64?: string,
  tryOnBase64?: string
): Promise<ClothingItem> {
  if (!isSupabaseConfigured()) {
    const catalog = await getStoredCatalog();
    const updatedItem: ClothingItem = {
      id: input.id,
      store_id: input.store_id || DEFAULT_DEMO_STORE.id,
      name: input.name,
      description: input.description,
      category: input.category,
      price: input.price,
      currency: input.currency || 'BRL',
      sizes: input.sizes,
      stock: input.stock,
      active: input.active,
      image: catalogBase64 || input.image_url,
      try_on_reference_image: tryOnBase64 || input.try_on_reference_url || catalogBase64 || input.image_url,
    };
    const updatedCatalog = catalog.map((item) => (item.id === input.id ? updatedItem : item));
    await saveStoredCatalog(updatedCatalog);
    return updatedItem;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Usuário precisa estar autenticado para atualizar produtos.');
  }

  const response = await fetch(`/api/products/${input.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      store_id: input.store_id || DEFAULT_DEMO_STORE.id,
      ...input,
      catalogImageBase64: catalogBase64,
      tryOnImageBase64: tryOnBase64,
    }),
  });

  const resJson = await response.json();
  if (!response.ok) {
    throw new Error(resJson.error || 'Erro ao atualizar produto.');
  }

  return resJson.product;
}

/**
 * Excluir produto via Express API
 */
export async function deleteProduct(productId: string, storeId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const catalog = await getStoredCatalog();
    const filtered = catalog.filter((item) => item.id !== productId);
    await saveStoredCatalog(filtered);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Usuário precisa estar autenticado para excluir produtos.');
  }

  const response = await fetch(`/api/products/${productId}?store_id=${storeId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const resJson = await response.json();
  if (!response.ok) {
    throw new Error(resJson.error || 'Erro ao excluir produto.');
  }
}

/**
 * Buscar e atualizar configurações de Provedor de IA da loja
 */
export async function getStoreAISettings(storeId: string): Promise<StoreAISettings> {
  const defaultSettings: StoreAISettings = {
    store_id: storeId,
    provider_mode: 'both',
    enabled: true,
  };

  if (!isSupabaseConfigured()) return defaultSettings;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`/api/admin/store-ai-settings/${storeId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) return defaultSettings;

  const data = await response.json();
  return {
    store_id: storeId,
    provider_mode: data.provider_mode || 'both',
    enabled: data.enabled ?? true,
  };
}

export async function updateStoreAISettings(
  storeId: string,
  provider_mode: 'perfectcorp' | 'google' | 'both',
  enabled: boolean
): Promise<StoreAISettings> {
  const settings: StoreAISettings = {
    store_id: storeId,
    provider_mode,
    enabled,
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) return settings;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Usuário precisa estar autenticado para atualizar configurações da loja.');
  }

  const response = await fetch('/api/admin/store-ai-settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      store_id: storeId,
      provider_mode,
      enabled,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao atualizar configurações da loja.');
  }

  return settings;
}
