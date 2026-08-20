// server/routes/catalogRoutes.ts
import { Router, Response } from 'express';
import { requireAuth, requireStoreAdmin } from '../middleware/authMiddleware.js';
import { CatalogService } from '../services/CatalogService.js';
import { GarmentPreparationService } from '../services/GarmentPreparationService.js';
import { AuthenticatedRequest, Product } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const catalogRouter = Router();
const catalogService = new CatalogService();
const garmentPrepService = new GarmentPreparationService();

// Get active products for a store
catalogRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Query parameter storeId is required.' });
      return;
    }

    const products = await catalogService.getStoreProducts(storeId);
    res.json(products);
  } catch (err) {
    logger.error('Error in GET /api/products', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch catalog.' });
  }
});

// Get product details by ID
catalogRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const product = await catalogService.getProductById(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Product not found.' });
      return;
    }
    res.json(product);
  } catch (err) {
    logger.error('Error in GET /api/products/:id', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch product.' });
  }
});

// Admin: Process garment visual preparation (model removal, isolation, quality gate)
catalogRouter.post('/:id/prepare-garment', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const productId = req.params.id;
    const storeId = req.body.storeId || (req.query.storeId as string);

    if (!storeId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'storeId is required.' });
      return;
    }

    const prepMetadata = await garmentPrepService.processProductGarmentPreparation(productId, storeId);
    res.json(prepMetadata);
  } catch (err: any) {
    logger.error('Error in POST /api/products/:id/prepare-garment', err);
    res.status(500).json({
      error: err?.code || 'GARMENT_PREPARATION_ERROR',
      message: err instanceof Error ? err.message : 'Falha ao processar preparação visual da peça.',
    });
  }
});

// Admin: Create product
catalogRouter.post('/', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const productData: Product = req.body;
    if (!productData.storeId || !productData.name || !productData.category || productData.price === undefined) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'storeId, name, category, and price are required.' });
      return;
    }

    const newProduct = await catalogService.createProduct(productData);

    // Asynchronously trigger automatic garment preparation in the background
    const hasCatalogPhoto = newProduct.photos?.some(p => p.type === 'catalog' && p.storagePath);
    if (hasCatalogPhoto && newProduct.id && newProduct.storeId) {
      garmentPrepService.processProductGarmentPreparation(newProduct.id, newProduct.storeId).catch(err => {
        logger.warn('[CatalogRoutes] Background garment preparation notice for new product:', {
          productId: newProduct.id,
          error: err?.message,
        });
      });
    }

    res.status(201).json(newProduct);
  } catch (err) {
    logger.error('Error in POST /api/products', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err instanceof Error ? err.message : 'Failed to create product.' });
  }
});

// Admin: Update product
catalogRouter.put('/:id', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const productId = req.params.id;
    const productData: Partial<Product> = req.body;

    const updated = await catalogService.updateProduct(productId, productData);

    // If photos updated, trigger background preparation
    const hasCatalogPhoto = updated.photos?.some(p => p.type === 'catalog' && p.storagePath);
    if (hasCatalogPhoto && updated.id && updated.storeId) {
      garmentPrepService.processProductGarmentPreparation(updated.id, updated.storeId).catch(err => {
        logger.warn('[CatalogRoutes] Background garment preparation notice for updated product:', {
          productId: updated.id,
          error: err?.message,
        });
      });
    }

    res.json(updated);
  } catch (err) {
    logger.error('Error in PUT /api/products/:id', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err instanceof Error ? err.message : 'Failed to update product.' });
  }
});

// Admin: Delete product
catalogRouter.delete('/:id', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const productId = req.params.id;
    const deleted = await catalogService.deleteProduct(productId);
    res.json({ success: deleted, productId });
  } catch (err) {
    logger.error('Error in DELETE /api/products/:id', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err instanceof Error ? err.message : 'Failed to delete product.' });
  }
});
