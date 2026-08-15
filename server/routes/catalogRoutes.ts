// server/routes/catalogRoutes.ts
import { Router, Response } from 'express';
import { requireAuth, requireStoreAdmin } from '../middleware/authMiddleware.js';
import { CatalogService } from '../services/CatalogService.js';
import { AuthenticatedRequest, Product } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const catalogRouter = Router();
const catalogService = new CatalogService();

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

// Admin: Create product
catalogRouter.post('/', requireAuth, requireStoreAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const productData: Product = req.body;
    if (!productData.storeId || !productData.name || !productData.category || productData.price === undefined) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'storeId, name, category, and price are required.' });
      return;
    }

    const newProduct = await catalogService.createProduct(productData);
    res.status(201).json(newProduct);
  } catch (err) {
    logger.error('Error in POST /api/products', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err instanceof Error ? err.message : 'Failed to create product.' });
  }
});
