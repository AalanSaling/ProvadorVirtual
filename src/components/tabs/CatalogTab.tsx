// src/components/tabs/CatalogTab.tsx
import React, { useState } from 'react';
import { ClothingItem } from '../../types';
import { CatalogCard } from '../CatalogCard';
import { ProductFormModal } from '../ProductFormModal';
import { AdminPasswordModal } from '../AdminPasswordModal';
import { categories } from '../../data/catalog';
import { createProduct, updateProduct, deleteProduct } from '../../lib/products';
import { getAdminPassword } from '../../lib/storage';
import { Search, Plus, Edit2, Trash2, ShoppingBag } from 'lucide-react';

interface CatalogTabProps {
  catalog: ClothingItem[];
  selectedItem: ClothingItem | null;
  onSelectGarment: (item: ClothingItem) => void;
  onRefreshCatalog: () => void;
  onGoToProvador: () => void;
  isDark?: boolean;
}

export const CatalogTab: React.FC<CatalogTabProps> = ({
  catalog,
  selectedItem,
  onSelectGarment,
  onRefreshCatalog,
  onGoToProvador,
  isDark = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ClothingItem | null>(null);

  // Admin Auth Modal State
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'create' | 'update' | 'delete';
    product?: ClothingItem;
    imageBase64?: string;
    deleteId?: string;
  } | null>(null);

  const filteredCatalog = catalog.filter((item) => {
    const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const handleOpenEditModal = (item: ClothingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProduct(item);
    setShowProductModal(true);
  };

  const handleDeleteRequest = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Tem certeza que deseja remover "${name}" do catálogo?`)) {
      const pwd = getAdminPassword();
      if (!pwd) {
        setPendingAction({ type: 'delete', deleteId: id });
        setShowAdminModal(true);
      } else {
        executeDelete(id, pwd);
      }
    }
  };

  const executeDelete = async (id: string, pwd: string) => {
    try {
      await deleteProduct(id, pwd);
      onRefreshCatalog();
      alert('Produto removido com sucesso!');
    } catch (err: any) {
      alert(`Erro ao remover produto: ${err.message}`);
    }
  };

  const handleSaveProductFromModal = (productToSave: ClothingItem) => {
    const pwd = getAdminPassword();
    const actionType = editingProduct ? 'update' : 'create';

    const imageBase64 = productToSave.image.startsWith('data:') ? productToSave.image : undefined;

    if (!pwd) {
      setPendingAction({
        type: actionType,
        product: productToSave,
        imageBase64,
      });
      setShowProductModal(false);
      setShowAdminModal(true);
    } else {
      executeSave(actionType, productToSave, imageBase64, pwd);
      setShowProductModal(false);
    }
  };

  const executeSave = async (
    type: 'create' | 'update',
    product: ClothingItem,
    imageBase64: string | undefined,
    pwd: string
  ) => {
    try {
      if (type === 'create') {
        await createProduct(product, imageBase64, pwd);
        alert('Novo produto criado com sucesso!');
      } else {
        await updateProduct(product, imageBase64, pwd);
        alert('Produto atualizado com sucesso!');
      }
      onRefreshCatalog();
    } catch (err: any) {
      alert(`Erro ao salvar produto: ${err.message}`);
    }
  };

  const handleAdminConfirm = (password: string) => {
    setShowAdminModal(false);
    if (!pendingAction) return;

    if (pendingAction.type === 'delete' && pendingAction.deleteId) {
      executeDelete(pendingAction.deleteId, password);
    } else if (pendingAction.product) {
      executeSave(
        pendingAction.type as 'create' | 'update',
        pendingAction.product,
        pendingAction.imageBase64,
        password
      );
    }

    setPendingAction(null);
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* Header */}
      <div className={`p-5 rounded-3xl border shadow-sm ${
        isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/90 border-slate-200/80'
      }`}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
              Gerenciamento Seguro
            </span>
            <h1 className="text-xl font-extrabold tracking-tight">Catálogo de Roupas</h1>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Peça</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, tecido, estilo..."
            className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                : 'bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pt-3 pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-blue-500 text-white shadow-xs'
                    : isDark
                    ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Catalog Grid */}
      {filteredCatalog.length === 0 ? (
        <div className={`p-8 rounded-3xl border text-center ${
          isDark ? 'bg-slate-800/40 border-slate-700/40' : 'bg-slate-100/60 border-slate-200/60'
        }`}>
          <ShoppingBag className="w-12 h-12 mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-bold">Nenhuma peça encontrada</p>
          <p className="text-xs text-slate-400 mt-1">Tente buscar por outro termo ou mude a categoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredCatalog.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            return (
              <div key={item.id} className="relative group">
                <CatalogCard
                  item={item}
                  selected={isSelected}
                  onSelect={() => {
                    onSelectGarment(item);
                    onGoToProvador();
                  }}
                  onQuickTryOn={() => {
                    onSelectGarment(item);
                    onGoToProvador();
                  }}
                  isDark={isDark}
                />

                {/* Edit / Delete Actions */}
                <div className="absolute top-2 right-2 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleOpenEditModal(item, e)}
                    className="p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-blue-600 backdrop-blur-xs"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteRequest(item.id, item.name, e)}
                    className="p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 backdrop-blur-xs"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product Form Modal */}
      <ProductFormModal
        visible={showProductModal}
        initialProduct={editingProduct}
        onSave={handleSaveProductFromModal}
        onClose={() => setShowProductModal(false)}
        isDark={isDark}
      />

      {/* Admin Password Prompt Modal */}
      <AdminPasswordModal
        visible={showAdminModal}
        onConfirm={handleAdminConfirm}
        onClose={() => {
          setShowAdminModal(false);
          setPendingAction(null);
        }}
        isDark={isDark}
      />
    </div>
  );
};
