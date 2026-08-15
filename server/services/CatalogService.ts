// server/services/CatalogService.ts
import { supabaseAdmin } from '../middleware/authMiddleware.js';
import { Product, ProductPhoto } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class CatalogService {
  /**
   * Lists active products for a store.
   */
  public async getStoreProducts(storeId: string): Promise<Product[]> {
    const { data: productsData, error: prodError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (prodError) {
      logger.error('Error fetching products', prodError, { storeId });
      throw new Error(`CATALOG_FETCH_ERROR: ${prodError.message}`);
    }

    if (!productsData || productsData.length === 0) {
      return [];
    }

    const productIds = productsData.map(p => p.id);

    const { data: photosData, error: photoError } = await supabaseAdmin
      .from('product_photos')
      .select('*')
      .in('product_id', productIds)
      .order('sort_order', { ascending: true });

    if (photoError) {
      logger.warn('Error fetching product photos', { error: photoError.message });
    }

    const photosByProduct = new Map<string, ProductPhoto[]>();
    photosData?.forEach(photo => {
      const list = photosByProduct.get(photo.product_id) || [];
      list.push({
        id: photo.id,
        productId: photo.product_id,
        type: photo.type as 'catalog' | 'try_on_reference',
        storagePath: photo.storage_path,
        sortOrder: photo.sort_order,
      });
      photosByProduct.set(photo.product_id, list);
    });

    return productsData.map(p => ({
      id: p.id,
      storeId: p.store_id,
      name: p.name,
      description: p.description,
      category: p.category,
      garmentType: p.garment_type,
      color: p.color,
      material: p.material,
      fit: p.fit,
      price: Number(p.price),
      currency: p.currency,
      sizes: p.sizes || [],
      stock: p.stock,
      active: p.active,
      photos: photosByProduct.get(p.id) || [],
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  }

  /**
   * Retrieves a single product with photos.
   */
  public async getProductById(productId: string): Promise<Product | null> {
    const { data: p, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (error || !p) return null;

    const { data: photos } = await supabaseAdmin
      .from('product_photos')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    return {
      id: p.id,
      storeId: p.store_id,
      name: p.name,
      description: p.description,
      category: p.category,
      garmentType: p.garment_type,
      color: p.color,
      material: p.material,
      fit: p.fit,
      price: Number(p.price),
      currency: p.currency,
      sizes: p.sizes || [],
      stock: p.stock,
      active: p.active,
      photos: (photos || []).map(ph => ({
        id: ph.id,
        productId: ph.product_id,
        type: ph.type as 'catalog' | 'try_on_reference',
        storagePath: ph.storage_path,
        sortOrder: ph.sort_order,
      })),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  }

  /**
   * Creates a new product (Admin action).
   */
  public async createProduct(product: Product): Promise<Product> {
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        store_id: product.storeId,
        name: product.name,
        description: product.description,
        category: product.category,
        garment_type: product.garmentType,
        color: product.color,
        material: product.material,
        fit: product.fit,
        price: product.price,
        currency: product.currency,
        sizes: product.sizes,
        stock: product.stock,
        active: product.active ?? true,
      })
      .select()
      .single();

    if (error || !data) {
      logger.error('Error creating product', error);
      throw new Error(`CREATE_PRODUCT_ERROR: ${error?.message || 'Failed to create product'}`);
    }

    if (product.photos && product.photos.length > 0) {
      const photosToInsert = product.photos.map(photo => ({
        product_id: data.id,
        type: photo.type,
        storage_path: photo.storagePath,
        sort_order: photo.sortOrder || 0,
      }));

      await supabaseAdmin.from('product_photos').insert(photosToInsert);
    }

    return (await this.getProductById(data.id))!;
  }
}
