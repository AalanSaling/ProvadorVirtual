// server/services/CatalogService.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../middleware/authMiddleware.js';
import { Product, ProductPhoto, GarmentCategory, CurrencyCode } from '../types/index.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const STORAGE_FILE = path.join(DATA_DIR, 'catalog_storage.json');

export function createInitialSeedProducts(storeId: string): Product[] {
  const baseItems = [
    // --- Masculino ---
    {
      name: 'Camiseta Básica Algodão Nobre Preta',
      description: 'Camiseta masculina manga curta em 100% algodão nobre com toque macio e caimento impecável.',
      category: 'upper_body' as GarmentCategory,
      garmentType: 't-shirt',
      color: 'Preto',
      material: '100% Algodão',
      fit: 'Regular Fit',
      price: 119.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['P', 'M', 'G', 'GG'],
      stock: 25,
      photoUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80',
    },
    {
      name: 'Camiseta Branca Premium Heavyweight',
      description: 'Camiseta clássica gola careca reforçada em malha encorpada de alta densidade.',
      category: 'upper_body' as GarmentCategory,
      garmentType: 't-shirt',
      color: 'Branco',
      material: 'Algodão Penteado',
      fit: 'Relaxed Fit',
      price: 129.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['P', 'M', 'G', 'GG'],
      stock: 20,
      photoUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&q=80',
    },
    {
      name: 'Camisa Social Masculina Azul-Marinho',
      description: 'Camisa social manga longa com corte alfaiataria em tricoline acetinado.',
      category: 'upper_body' as GarmentCategory,
      garmentType: 'shirt',
      color: 'Azul-Marinho',
      material: 'Tricoline',
      fit: 'Slim Fit',
      price: 289.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['2', '3', '4', '5'],
      stock: 14,
      photoUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80',
    },
    {
      name: 'Camisa Polo Piquet Cinza Mescla',
      description: 'Polo clássica com peitilho de 2 botões e gola canelada estruturada.',
      category: 'upper_body' as GarmentCategory,
      garmentType: 'polo',
      color: 'Cinza Mescla',
      material: 'Piquet de Algodão',
      fit: 'Regular Fit',
      price: 199.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['P', 'M', 'G', 'GG'],
      stock: 18,
      photoUrl: 'https://images.unsplash.com/photo-1625910513413-7fc430c5e9f8?w=800&q=80',
    },
    {
      name: 'Jaqueta Bomber Urbana Preta',
      description: 'Jaqueta bomber corta-vento com acabamento acetinado e punhos canelados.',
      category: 'upper_body' as GarmentCategory,
      garmentType: 'jacket',
      color: 'Preto',
      material: 'Poliéster Hidrorrepelente',
      fit: 'Regular Fit',
      price: 449.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['M', 'G', 'GG'],
      stock: 10,
      photoUrl: 'https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?w=800&q=80',
    },
    {
      name: 'Calça Jeans Masculina Índigo Escuro',
      description: 'Jeans clássico 5 pockets com lavagem índigo escuro e 2% elastano para flexibilidade.',
      category: 'lower_body' as GarmentCategory,
      garmentType: 'jeans',
      color: 'Azul Escuro',
      material: 'Jeans com Elastano',
      fit: 'Slim Straight',
      price: 329.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['38', '40', '42', '44', '46'],
      stock: 15,
      photoUrl: 'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&q=80',
    },
    {
      name: 'Calça Chino Alfaiataria Bege Areia',
      description: 'Calça chino em sarja macia com bolsos faca e acabamento refinado.',
      category: 'lower_body' as GarmentCategory,
      garmentType: 'pants',
      color: 'Bege',
      material: 'Sarja Acetinada',
      fit: 'Tailored Fit',
      price: 299.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['38', '40', '42', '44'],
      stock: 12,
      photoUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&q=80',
    },
    {
      name: 'Bermuda Casual Sarja Preta',
      description: 'Bermuda leve e versátil acima do joelho para ocasiões descontraídas.',
      category: 'lower_body' as GarmentCategory,
      garmentType: 'shorts',
      color: 'Preto',
      material: 'Sarja Leve',
      fit: 'Casual Fit',
      price: 189.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['38', '40', '42', '44'],
      stock: 16,
      photoUrl: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&q=80',
    },
    {
      name: 'Blazer Estruturado Masculino Preto',
      description: 'Blazer de alfaiataria italiana com forro acetinado e lapela chanfrada.',
      category: 'upper_body' as GarmentCategory,
      garmentType: 'blazer',
      color: 'Preto',
      material: 'Lã Fria e Viscose',
      fit: 'Modern Slim',
      price: 599.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['48', '50', '52', '54'],
      stock: 8,
      photoUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80',
    },
    {
      name: 'Tênis Casual Couro Minimalista Branco',
      description: 'Sneaker monocromático em couro legítimo macio com solado costurado.',
      category: 'shoes' as GarmentCategory,
      garmentType: 'sneakers',
      color: 'Branco',
      material: 'Couro Bovino Natural',
      fit: 'Tamanho Padrão',
      price: 379.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['39', '40', '41', '42', '43'],
      stock: 15,
      photoUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
    },

    // --- Feminino ---
    {
      name: 'Vestido Longo Seda Champagne Real',
      description: 'Vestido longo fluido em seda pura acetinada com fenda lateral e caimento elegante.',
      category: 'full_body' as GarmentCategory,
      garmentType: 'dress',
      color: 'Champagne',
      material: 'Seda Pura',
      fit: 'Fluido',
      price: 499.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['PP', 'P', 'M', 'G'],
      stock: 10,
      photoUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',
    },
    {
      name: 'Vestido Midi Floral Tropical Evasê',
      description: 'Vestido evasê em viscose fresca com estampa botânica vibrante e decote V.',
      category: 'full_body' as GarmentCategory,
      garmentType: 'dress',
      color: 'Floral Tropical',
      material: 'Viscose Estampada',
      fit: 'Evasê',
      price: 389.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['P', 'M', 'G'],
      stock: 12,
      photoUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&q=80',
    },
    {
      name: 'Blusa Cropped Linho Puro Off-White',
      description: 'Cropped estruturado com amarração nas costas e tecido respirável de linho nobre.',
      category: 'upper_body' as GarmentCategory,
      garmentType: 'top',
      color: 'Off-White',
      material: '100% Linho',
      fit: 'Custom Fit',
      price: 179.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['PP', 'P', 'M', 'G'],
      stock: 18,
      photoUrl: 'https://images.unsplash.com/photo-1534126511673-b6899657816a?w=800&q=80',
    },
    {
      name: 'Saia Midi Plissada Terracota',
      description: 'Saia plissada com cós elástico confortável e movimento gracioso.',
      category: 'lower_body' as GarmentCategory,
      garmentType: 'skirt',
      color: 'Terracota',
      material: 'Crepe Plissado',
      fit: 'Midi Ampla',
      price: 259.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['P', 'M', 'G'],
      stock: 14,
      photoUrl: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&q=80',
    },
    {
      name: 'Blazer Alfaiataria Feminino Bege Areia',
      description: 'Blazer alongado feminino com ombreiras sutis e botões em madrepérola.',
      category: 'upper_body' as GarmentCategory,
      garmentType: 'blazer',
      color: 'Bege Areia',
      material: 'Alfaiataria Crepe',
      fit: 'Oversized Chic',
      price: 459.0,
      currency: 'BRL' as CurrencyCode,
      sizes: ['P', 'M', 'G'],
      stock: 9,
      photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&q=80',
    },
  ];

  const now = new Date().toISOString();
  return baseItems.map((item, index) => {
    const prodId = crypto.randomUUID();
    const photoId = crypto.randomUUID();
    return {
      id: prodId,
      storeId,
      name: item.name,
      description: item.description,
      category: item.category,
      garmentType: item.garmentType,
      color: item.color,
      material: item.material,
      fit: item.fit,
      price: item.price,
      currency: item.currency,
      sizes: item.sizes,
      stock: item.stock,
      active: true,
      photos: [
        {
          id: photoId,
          productId: prodId,
          type: 'catalog' as const,
          storagePath: item.photoUrl,
          sortOrder: 0,
        },
      ],
      createdAt: new Date(Date.now() - (baseItems.length - index) * 60000).toISOString(),
      updatedAt: now,
    };
  });
}

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
   * Seeds initial diverse catalog for a store if it currently has no products or only single repeated placeholder.
   */
  public seedInitialCatalog(storeId: string): Product[] {
    const seedItems = createInitialSeedProducts(storeId);
    seedItems.forEach(p => this.inMemoryStore.set(p.id, p));
    this.persistLocalStorage();
    logger.info(`[CatalogService] Seeded ${seedItems.length} diverse initial products for store '${storeId}'.`);
    return seedItems;
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
    let localStoreProducts = Array.from(this.inMemoryStore.values()).filter(
      p => p.storeId === storeId && p.active !== false
    );

    // If store has 0 products or only has duplicates of the single old dress from earlier tests, seed initial diverse items
    const isSingleDuplicateOldDress =
      localStoreProducts.length > 0 &&
      localStoreProducts.every(p => p.name === 'Vestido Seda Champagne Real');

    if (localStoreProducts.length === 0 || isSingleDuplicateOldDress) {
      // Clean previous duplicates if any
      if (isSingleDuplicateOldDress) {
        localStoreProducts.forEach(p => this.inMemoryStore.delete(p.id));
      }
      localStoreProducts = this.seedInitialCatalog(storeId);
    }

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
