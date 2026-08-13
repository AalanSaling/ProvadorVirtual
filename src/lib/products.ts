// src/lib/products.ts
// Gerenciamento seguro de produtos com chamadas para a Edge Function admin-products

import { ClothingItem } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { getStoredCatalog, saveStoredCatalog } from './storage';

/**
 * Busca a lista pública de produtos do banco de dados Supabase
 */
export async function getProducts(): Promise<ClothingItem[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          category: item.category,
          price: Number(item.price),
          image: item.image_url || item.image,
          description: item.description || '',
          sizes: item.sizes || ['P', 'M', 'G'],
          stock: item.stock || 10,
        }));
      }
    } catch (e) {
      console.warn('Falha ao buscar produtos remotos, carregando catálogo local:', e);
    }
  }

  return getStoredCatalog();
}

/**
 * Cria um novo produto através da Edge Function admin-products
 */
export async function createProduct(
  product: Omit<ClothingItem, 'id'>,
  imageBase64: string | undefined,
  adminPassword: string
): Promise<ClothingItem> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.functions.invoke('admin-products', {
      headers: {
        Authorization: `Bearer ${adminPassword}`,
      },
      body: {
        action: 'create',
        product,
        imageBase64,
      },
    });

    if (error || !data || data.error) {
      throw new Error(
        data?.error || error?.message || 'Falha ao criar produto. Verifique a senha administrativa.'
      );
    }

    const created = data.product;
    return {
      id: created.id.toString(),
      name: created.name,
      category: created.category,
      price: Number(created.price),
      image: created.image_url || product.image,
      description: created.description,
      sizes: created.sizes,
      stock: created.stock,
    };
  }

  // Fallback Local Storage se o Supabase não estiver configurado
  const localItem: ClothingItem = {
    ...product,
    id: Date.now().toString(),
    image: imageBase64 || product.image,
  };

  const catalog = getStoredCatalog();
  const updated = [localItem, ...catalog];
  saveStoredCatalog(updated);
  return localItem;
}

/**
 * Atualiza um produto existente através da Edge Function admin-products
 */
export async function updateProduct(
  product: ClothingItem,
  imageBase64: string | undefined,
  adminPassword: string
): Promise<ClothingItem> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.functions.invoke('admin-products', {
      headers: {
        Authorization: `Bearer ${adminPassword}`,
      },
      body: {
        action: 'update',
        product,
        imageBase64,
      },
    });

    if (error || !data || data.error) {
      throw new Error(
        data?.error || error?.message || 'Falha ao atualizar produto. Verifique a senha administrativa.'
      );
    }

    const updated = data.product;
    return {
      id: updated.id.toString(),
      name: updated.name,
      category: updated.category,
      price: Number(updated.price),
      image: updated.image_url || product.image,
      description: updated.description,
      sizes: updated.sizes,
      stock: updated.stock,
    };
  }

  // Fallback Local Storage
  const catalog = getStoredCatalog();
  const updatedCatalog = catalog.map((item) =>
    item.id === product.id ? { ...product, image: imageBase64 || product.image } : item
  );
  saveStoredCatalog(updatedCatalog);
  return product;
}

/**
 * Exclui um produto através da Edge Function admin-products
 */
export async function deleteProduct(id: string, adminPassword: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.functions.invoke('admin-products', {
      headers: {
        Authorization: `Bearer ${adminPassword}`,
      },
      body: {
        action: 'delete',
        product: { id },
      },
    });

    if (error || (data && data.error)) {
      throw new Error(
        data?.error || error?.message || 'Falha ao excluir produto. Verifique a senha administrativa.'
      );
    }
  }

  // Fallback Local Storage
  const catalog = getStoredCatalog();
  const filtered = catalog.filter((item) => item.id !== id);
  saveStoredCatalog(filtered);
}
