// server/services/CatalogService.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../middleware/authMiddleware.js';
import { Product, ProductPhoto } from '../types/index.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const STORAGE_FILE = path.join(DATA_DIR, 'catalog_storage.json');

export class CatalogService {
  private inMemoryStore: Map<string, Product> = new Map();
  private isLoaded = false;

  constructor() {
    this.ensureStorage();
  }

  private ensureStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        if (raw.trim()) {
          const list: Product[] = JSON.parse(raw);
          list.forEach(p => this.inMemoryStore.set(p.id, p));
        }
      }
      this.isLoaded = true;
    } catch (e: any) {
      logger.warn('[CatalogService] Could not load local catalog file:', e.message);
      this.isLoaded = true;
    }
  }

  private persistLocalStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const list = Array.from(this.inMemoryStore.values());
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e: any) {
      logger.error('[CatalogService] Failed to persist local catalog:', e.message);
    }
  }

  /**
   * Lists active products for a store.
   */
  public async getStoreProducts(storeId: string): Promise<Product[]> {
    this.ensureStorage();

    // 1. Try fetching from Supabase Postgres
    try {
      const { data: productsData, error: prodError } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (!prodError && productsData && productsData.length > 0) {
        const productIds = productsData.map(p => p.id);

        const { data: photosData, error: photoError } = await supabaseAdmin
          .from('product_photos')
          .select('*')
          .in('product_id', productIds)
          .order('sort_order', { ascending: true });

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

        const supabaseList: Product[] = productsData.map(p => ({
          id: p.id,
          storeId: p.store_id,
          name: p.name,
          description: p.description || '',
          category: p.category,
          garmentType: p.garment_type || '',
          color: p.color || '',
          material: p.material || '',
          fit: p.fit || '',
          price: Number(p.price),
          currency: p.currency || 'BRL',
          sizes: p.sizes || ['P', 'M', 'G'],
          stock: p.stock ?? 10,
          active: p.active ?? true,
          photos: photosByProduct.get(p.id) || [],
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }));

        // Cache in memory
        supabaseList.forEach(p => this.inMemoryStore.set(p.id, p));
        this.persistLocalStorage();
        return supabaseList;
      }
    } catch (err: any) {
      logger.warn('[CatalogService] Supabase Postgres product fetch notice:', err.message);
    }

    // 2. Return from durable server storage for this store
    const localStoreProducts = Array.from(this.inMemoryStore.values()).filter(
      p => p.storeId === storeId && p.active !== false
    );

    return localStoreProducts;
  }

  /**
   * Retrieves a single product with photos.
   */
  public async getProductById(productId: string): Promise<Product | null> {
    this.ensureStorage();

    // 1. Try fetching from Supabase Postgres
    try {
      const { data: p, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      if (!error && p) {
        const { data: photos } = await supabaseAdmin
          .from('product_photos')
          .select('*')
          .eq('product_id', productId)
          .order('sort_order', { ascending: true });

        const prod: Product = {
          id: p.id,
          storeId: p.store_id,
          name: p.name,
          description: p.description || '',
          category: p.category,
          garmentType: p.garment_type || '',
          color: p.color || '',
          material: p.material || '',
          fit: p.fit || '',
          price: Number(p.price),
          currency: p.currency || 'BRL',
          sizes: p.sizes || ['P', 'M', 'G'],
          stock: p.stock ?? 10,
          active: p.active ?? true,
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

        this.inMemoryStore.set(prod.id, prod);
        this.persistLocalStorage();
        return prod;
      }
    } catch (err: any) {
      logger.warn('[CatalogService] Supabase getProductById notice:', err.message);
    }

    // 2. Return from durable server storage
    return this.inMemoryStore.get(productId) || null;
  }

  /**
   * Creates a new product with real UUID and photos.
   */
  public async createProduct(productData: Partial<Product>): Promise<Product> {
    this.ensureStorage();

    const id = productData.id && productData.id.length > 10 ? productData.id : crypto.randomUUID();
    const storeId = productData.storeId || 'store-atelier-01';
    const now = new Date().toISOString();

    const photos: ProductPhoto[] = (productData.photos || []).map((ph, idx) => ({
      id: ph.id || crypto.randomUUID(),
      productId: id,
      type: ph.type || 'catalog',
      storagePath: ph.storagePath,
      sortOrder: ph.sortOrder !== undefined ? ph.sortOrder : idx,
    }));

    const newProduct: Product = {
      id,
      storeId,
      name: productData.name || 'Nova Peça',
      description: productData.description || '',
      category: productData.category || 'full_body',
      garmentType: productData.garmentType || '',
      color: productData.color || '',
      material: productData.material || '',
      fit: productData.fit || '',
      price: productData.price !== undefined ? Number(productData.price) : 0,
      currency: productData.currency || 'BRL',
      sizes: productData.sizes && productData.sizes.length > 0 ? productData.sizes : ['P', 'M', 'G'],
      stock: productData.stock !== undefined ? Number(productData.stock) : 10,
      active: productData.active !== undefined ? productData.active : true,
      photos,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Try inserting to Supabase Postgres
    try {
      const { error: insertError } = await supabaseAdmin.from('products').insert({
        id: newProduct.id,
        store_id: newProduct.storeId,
        name: newProduct.name,
        description: newProduct.description,
        category: newProduct.category,
        garment_type: newProduct.garmentType,
        color: newProduct.color,
        material: newProduct.material,
        fit: newProduct.fit,
        price: newProduct.price,
        currency: newProduct.currency,
        sizes: newProduct.sizes,
        stock: newProduct.stock,
        active: newProduct.active,
        created_at: newProduct.createdAt,
        updated_at: newProduct.updatedAt,
      });

      if (!insertError && photos.length > 0) {
        await supabaseAdmin.from('product_photos').insert(
          photos.map(p => ({
            id: p.id,
            product_id: newProduct.id,
            type: p.type,
            storage_path: p.storagePath,
            sort_order: p.sortOrder || 0,
          }))
        );
      }
    } catch (err: any) {
      logger.warn('[CatalogService] Supabase Postgres product insert fallback to durable storage:', err.message);
    }

    // 2. Save in durable server memory and disk
    this.inMemoryStore.set(newProduct.id, newProduct);
    this.persistLocalStorage();

    logger.info(`[CatalogService] Product created successfully with ID '${newProduct.id}' in store '${newProduct.storeId}'.`);
    return newProduct;
  }

  /**
   * Updates an existing product.
   */
  public async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    this.ensureStorage();

    const existing = await this.getProductById(productId);
    if (!existing) {
      throw new Error(`Product with ID '${productId}' not found.`);
    }

    const now = new Date().toISOString();
    let updatedPhotos = existing.photos;
    if (productData.photos) {
      updatedPhotos = productData.photos.map((ph, idx) => ({
        id: ph.id || crypto.randomUUID(),
        productId,
        type: ph.type || 'catalog',
        storagePath: ph.storagePath,
        sortOrder: ph.sortOrder !== undefined ? ph.sortOrder : idx,
      }));
    }

    const updated: Product = {
      ...existing,
      ...productData,
      id: productId,
      storeId: existing.storeId,
      photos: updatedPhotos,
      updatedAt: now,
    };

    // 1. Try update in Supabase Postgres
    try {
      await supabaseAdmin
        .from('products')
        .update({
          name: updated.name,
          description: updated.description,
          category: updated.category,
          garment_type: updated.garmentType,
          color: updated.color,
          material: updated.material,
          fit: updated.fit,
          price: updated.price,
          currency: updated.currency,
          sizes: updated.sizes,
          stock: updated.stock,
          active: updated.active,
          updated_at: now,
        })
        .eq('id', productId);
    } catch (err: any) {
      logger.warn('[CatalogService] Supabase update notice:', err.message);
    }

    // 2. Update local storage
    this.inMemoryStore.set(productId, updated);
    this.persistLocalStorage();

    return updated;
  }

  /**
   * Deletes a product.
   */
  public async deleteProduct(productId: string): Promise<boolean> {
    this.ensureStorage();

    try {
      await supabaseAdmin.from('product_photos').delete().eq('product_id', productId);
      await supabaseAdmin.from('products').delete().eq('id', productId);
    } catch (err: any) {
      logger.warn('[CatalogService] Supabase delete notice:', err.message);
    }

    const deleted = this.inMemoryStore.delete(productId);
    this.persistLocalStorage();
    return deleted;
  }

  /**
   * Updates or attaches a dedicated 'try_on_reference' photo to a product.
   */
  public async updateTryOnReference(productId: string, tryOnRefUrl: string): Promise<Product> {
    this.ensureStorage();

    const product = await this.getProductById(productId);
    if (!product) {
      throw new Error(`Product '${productId}' not found.`);
    }

    const existingPhotos = product.photos || [];
    const nonRefPhotos = existingPhotos.filter(p => p.type !== 'try_on_reference');

    const newRefPhoto: ProductPhoto = {
      id: crypto.randomUUID(),
      productId,
      type: 'try_on_reference',
      storagePath: tryOnRefUrl,
      sortOrder: 1,
    };

    const combinedPhotos = [...nonRefPhotos, newRefPhoto];

    // Try Supabase update
    try {
      await supabaseAdmin
        .from('product_photos')
        .delete()
        .eq('product_id', productId)
        .eq('type', 'try_on_reference');

      await supabaseAdmin.from('product_photos').insert({
        id: newRefPhoto.id,
        product_id: productId,
        type: 'try_on_reference',
        storage_path: tryOnRefUrl,
        sort_order: 1,
      });
    } catch (err: any) {
      logger.warn('[CatalogService] Supabase updateTryOnReference notice:', err.message);
    }

    product.photos = combinedPhotos;
    product.updatedAt = new Date().toISOString();
    this.inMemoryStore.set(productId, product);
    this.persistLocalStorage();

    return product;
  }
}
