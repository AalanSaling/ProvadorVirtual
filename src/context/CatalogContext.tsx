// src/context/CatalogContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Product, GarmentCategory } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    storeId: 'store-atelier-01',
    name: 'Vestido Midi Floral Primavera',
    description: 'Vestido midi confeccionado em viscose leve e fluída, decote sutil em V e estampa floral exclusiva pintada à mão.',
    category: 'full_body',
    garmentType: 'Vestido Midi',
    color: 'Floral Rosa',
    material: 'Viscose 100%',
    fit: 'Fluído / Regular',
    price: 289.90,
    currency: 'BRL',
    sizes: ['PP', 'P', 'M', 'G'],
    stock: 12,
    active: true,
    photos: [
      {
        type: 'catalog',
        storagePath: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
      },
      {
        type: 'try_on_reference',
        storagePath: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
      },
    ],
  },
  {
    id: 'prod-002',
    storeId: 'store-atelier-01',
    name: 'Camiseta Oversized Streetwear',
    description: 'Camiseta premium em algodão Pima peruano de alta gramatura com caimento estruturado e gola canelada.',
    category: 'upper_body',
    garmentType: 'Camiseta',
    color: 'Off-White Grafite',
    material: 'Algodão Pima 100%',
    fit: 'Oversized',
    price: 149.00,
    currency: 'BRL',
    sizes: ['P', 'M', 'G', 'GG'],
    stock: 25,
    active: true,
    photos: [
      {
        type: 'catalog',
        storagePath: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80',
      },
      {
        type: 'try_on_reference',
        storagePath: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80',
      },
    ],
  },
  {
    id: 'prod-003',
    storeId: 'store-atelier-01',
    name: 'Calça Jeans Wide Leg Vintage',
    description: 'Calça jeans cintura alta com modelagem ampla wide leg e lavagem vintage especial com toque macio.',
    category: 'lower_body',
    garmentType: 'Calça Jeans',
    color: 'Jeans Denim Médio',
    material: 'Denim 100% Algodão',
    fit: 'Wide Leg',
    price: 180000,
    currency: 'PYG',
    sizes: ['36', '38', '40', '42'],
    stock: 8,
    active: true,
    photos: [
      {
        type: 'catalog',
        storagePath: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&q=80',
      },
      {
        type: 'try_on_reference',
        storagePath: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&q=80',
      },
    ],
  },
  {
    id: 'prod-004',
    storeId: 'store-atelier-01',
    name: 'Blazer Alfaiataria Crepe Noir',
    description: 'Blazer estruturado com ombros delineados, botões em resina fosca e forro em cetim maquinetado.',
    category: 'upper_body',
    garmentType: 'Blazer',
    color: 'Preto Noir',
    material: 'Crepe Alfaiataria',
    fit: 'Estruturado Tailored',
    price: 389.00,
    currency: 'BRL',
    sizes: ['P', 'M', 'G'],
    stock: 6,
    active: true,
    photos: [
      {
        type: 'catalog',
        storagePath: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80',
      },
      {
        type: 'try_on_reference',
        storagePath: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80',
      },
    ],
  },
  {
    id: 'prod-005',
    storeId: 'store-atelier-01',
    name: 'Saia Plissada Metalizada Gold',
    description: 'Saia midi plissada em tecido acetinado com reflexos dourados e cós elástico com acabamento lurex.',
    category: 'lower_body',
    garmentType: 'Saia Plissada',
    color: 'Champagne Dourado',
    material: 'Poliéster Acetinado',
    fit: 'Plissado Fluído',
    price: 219.00,
    currency: 'BRL',
    sizes: ['P', 'M', 'G'],
    stock: 15,
    active: true,
    photos: [
      {
        type: 'catalog',
        storagePath: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=600&q=80',
      },
      {
        type: 'try_on_reference',
        storagePath: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=600&q=80',
      },
    ],
  },
];

export type UserRole = 'owner' | 'manager' | 'customer';

interface CatalogContextType {
  products: Product[];
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  selectedTryOnProduct: Product | null;
  setSelectedTryOnProduct: (product: Product | null) => void;
  addProduct: (productData: Partial<Product>) => Product;
  editProduct: (id: string, productData: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  getProductById: (id: string) => Product | undefined;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [userRole, setUserRole] = useState<UserRole>('owner');
  const [selectedTryOnProduct, setSelectedTryOnProduct] = useState<Product | null>(null);

  function addProduct(productData: Partial<Product>): Product {
    const newProduct: Product = {
      id: productData.id || `prod-${Date.now()}`,
      storeId: productData.storeId || 'store-atelier-01',
      name: productData.name || 'Nova Peça',
      description: productData.description || '',
      category: productData.category || 'full_body',
      garmentType: productData.garmentType || '',
      color: productData.color || '',
      material: productData.material || '',
      fit: productData.fit || '',
      price: productData.price || 0,
      currency: productData.currency || 'BRL',
      sizes: productData.sizes && productData.sizes.length > 0 ? productData.sizes : ['P', 'M', 'G'],
      stock: productData.stock !== undefined ? productData.stock : 10,
      active: productData.active !== undefined ? productData.active : true,
      photos: productData.photos || [
        {
          type: 'catalog',
          storagePath: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
        },
        {
          type: 'try_on_reference',
          storagePath: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
        },
      ],
    };

    setProducts(prev => [newProduct, ...prev]);
    return newProduct;
  }

  function editProduct(id: string, productData: Partial<Product>) {
    setProducts(prev =>
      prev.map(prod => (prod.id === id ? ({ ...prod, ...productData } as Product) : prod))
    );
    if (selectedTryOnProduct?.id === id) {
      setSelectedTryOnProduct(prev => (prev ? ({ ...prev, ...productData } as Product) : null));
    }
  }

  function deleteProduct(id: string) {
    setProducts(prev => {
      const filtered = prev.filter(prod => prod.id !== id);
      if (selectedTryOnProduct?.id === id) {
        setSelectedTryOnProduct(null);
      }
      return filtered;
    });
  }

  function getProductById(id: string) {
    return products.find(p => p.id === id);
  }

  return (
    <CatalogContext.Provider
      value={{
        products,
        userRole,
        setUserRole,
        selectedTryOnProduct,
        setSelectedTryOnProduct,
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
