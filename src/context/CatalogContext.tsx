// src/context/CatalogContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Product, GarmentCategory } from '../types';
import { authenticatedFetch } from '../lib/authenticatedFetch';
import { useAuth } from './AuthContext';

export type UserRole = 'owner' | 'manager' | 'customer';

interface CatalogContextType {
  products: Product[];
  loading: boolean;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  currentStoreId: string;
  setCurrentStoreId: (id: string) => void;
  selectedTryOnProduct: Product | null;
  setSelectedTryOnProduct: (product: Product | null) => void;
  loadProducts: (storeId?: string) => Promise<Product[]>;
  addProduct: (productData: Partial<Product>) => Promise<Product>;
  editProduct: (id: string, productData: Partial<Product>) => Promise<Product>;
  deleteProduct: (id: string) => Promise<boolean>;
  getProductById: (id: string) => Product | undefined;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole>('owner');
  const [currentStoreId, setCurrentStoreId] = useState<string>('store-atelier-01');
  const [selectedTryOnProduct, setSelectedTryOnProductState] = useState<Product | null>(null);

  const setSelectedTryOnProduct = useCallback((product: Product | null) => {
    if (product) {
      console.log(
        `[CATALOG_DIAGNOSTIC] selectedProductId=${product.id} selectedProductName=${product.name} storeId=${product.storeId}`
      );
    }
    setSelectedTryOnProductState(product);
  }, []);

  const loadProducts = useCallback(
    async (storeIdToLoad?: string): Promise<Product[]> => {
      const targetStoreId = storeIdToLoad || currentStoreId;
      if (!targetStoreId) return [];

      setLoading(true);
      try {
        const res = await authenticatedFetch(`/api/products?storeId=${encodeURIComponent(targetStoreId)}`);
        if (!res.ok) {
          console.warn(`[CatalogContext] GET /api/products returned status ${res.status}`);
          setLoading(false);
          return [];
        }
        const data: Product[] = await res.json();
        const productList = Array.isArray(data) ? data : [];
        setProducts(productList);
        return productList;
      } catch (err: any) {
        console.warn('[CatalogContext] Error fetching products:', err?.message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [currentStoreId]
  );

  // Automatically load catalog when user is authenticated
  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadProducts(currentStoreId);
    } else if (authStatus === 'unauthenticated') {
      setProducts([]);
      setSelectedTryOnProductState(null);
    }
  }, [authStatus, currentStoreId, loadProducts]);

  const addProduct = async (productData: Partial<Product>): Promise<Product> => {
    const storeId = productData.storeId || currentStoreId;
    const payload = {
      ...productData,
      storeId,
    };

    const res = await authenticatedFetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Falha ao criar produto.');
    }

    const created: Product = await res.json();
    setProducts(prev => [created, ...prev]);
    return created;
  };

  const editProduct = async (id: string, productData: Partial<Product>): Promise<Product> => {
    const res = await authenticatedFetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Falha ao atualizar produto.');
    }

    const updated: Product = await res.json();
    setProducts(prev => prev.map(p => (p.id === id ? updated : p)));
    if (selectedTryOnProduct?.id === id) {
      setSelectedTryOnProductState(updated);
    }
    return updated;
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    const res = await authenticatedFetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Falha ao excluir produto.');
    }

    setProducts(prev => prev.filter(p => p.id !== id));
    if (selectedTryOnProduct?.id === id) {
      setSelectedTryOnProductState(null);
    }
    return true;
  };

  const getProductById = (id: string): Product | undefined => {
    return products.find(p => p.id === id);
  };

  return (
    <CatalogContext.Provider
      value={{
        products,
        loading,
        userRole,
        setUserRole,
        currentStoreId,
        setCurrentStoreId,
        selectedTryOnProduct,
        setSelectedTryOnProduct,
        loadProducts,
        addProduct,
        editProduct,
        deleteProduct,
        getProductById,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
}
