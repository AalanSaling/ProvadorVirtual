// src/screens/CatalogScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ClothingItem, Store, StoreRole } from '../types';
import { CatalogCard } from '../components/CatalogCard';
import { ProductFormModal } from '../components/ProductFormModal';
import { categories } from '../data/catalog';
import { createProduct, updateProduct, deleteProduct, getUserStores } from '../lib/products';
import { Search, Plus, ShoppingBag, Store as StoreIcon } from 'lucide-react-native';

interface CatalogScreenProps {
  catalog: ClothingItem[];
  selectedItem: ClothingItem | null;
  onSelectGarment: (item: ClothingItem) => void;
  onRefreshCatalog: () => void;
  onGoToProvador: () => void;
  isDark?: boolean;
}

export const CatalogScreen: React.FC<CatalogScreenProps> = ({
  catalog,
  selectedItem,
  onSelectGarment,
  onRefreshCatalog,
  onGoToProvador,
  isDark = true,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ClothingItem | null>(null);

  // Multi-Store and Auth State
  const [userStores, setUserStores] = useState<{ store: Store; role: StoreRole }[]>([]);
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [userRole, setUserRole] = useState<StoreRole | null>('owner');

  useEffect(() => {
    (async () => {
      const stores = await getUserStores();
      setUserStores(stores);
      if (stores.length > 0) {
        setActiveStore(stores[0].store);
        setUserRole(stores[0].role);
      }
    })();
  }, []);

  const filteredCatalog = catalog.filter((item) => {
    const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenAddModal = () => {
    if (userRole !== 'owner' && userRole !== 'manager') {
      alert('Apenas administradores da loja (Owner ou Manager) podem adicionar peças.');
      return;
    }
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const handleOpenEditModal = (item: ClothingItem) => {
    if (userRole !== 'owner' && userRole !== 'manager') {
      alert('Apenas administradores da loja podem editar peças.');
      return;
    }
    setEditingProduct(item);
    setShowProductModal(true);
  };

  const handleDeleteItem = async (item: ClothingItem) => {
    if (userRole !== 'owner') {
      alert('Apenas o Proprietário (Owner) da loja pode excluir produtos do catálogo.');
      return;
    }

    if (confirm(`Deseja realmente remover "${item.name}" do catálogo?`)) {
      try {
        await deleteProduct(item.id, activeStore?.id || item.store_id || 'demo-store-001');
        alert('Produto removido com sucesso!');
        onRefreshCatalog();
      } catch (e: any) {
        alert(`Erro ao excluir: ${e.message}`);
      }
    }
  };

  const handleSaveProductFromModal = async (
    productToSave: ClothingItem,
    catalogBase64?: string,
    tryOnBase64?: string
  ) => {
    setShowProductModal(false);
    try {
      if (editingProduct) {
        await updateProduct(
          {
            id: productToSave.id,
            store_id: activeStore?.id || productToSave.store_id || 'demo-store-001',
            name: productToSave.name,
            description: productToSave.description,
            category: productToSave.category,
            garment_type: productToSave.garment_type,
            color: productToSave.color,
            material: productToSave.material,
            fit: productToSave.fit,
            price: productToSave.price,
            currency: productToSave.currency || 'BRL',
            sizes: productToSave.sizes,
            stock: productToSave.stock,
            active: productToSave.active,
            image_url: productToSave.image,
            try_on_reference_url: productToSave.try_on_reference_image,
          },
          catalogBase64,
          tryOnBase64
        );
        alert('Produto atualizado no catálogo da loja!');
      } else {
        await createProduct(
          {
            store_id: activeStore?.id || 'demo-store-001',
            name: productToSave.name,
            description: productToSave.description,
            category: productToSave.category,
            garment_type: productToSave.garment_type,
            color: productToSave.color,
            material: productToSave.material,
            fit: productToSave.fit,
            price: productToSave.price,
            currency: productToSave.currency || 'BRL',
            sizes: productToSave.sizes,
            stock: productToSave.stock,
            active: productToSave.active,
            image_url: productToSave.image,
            try_on_reference_url: productToSave.try_on_reference_image,
          },
          catalogBase64,
          tryOnBase64
        );
        alert('Novo produto adicionado com sucesso ao catálogo!');
      }
      onRefreshCatalog();
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    }
  };

  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const inputBg = isDark ? '#0f172a' : '#f1f5f9';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Active Store Indicator */}
      {activeStore && (
        <View style={[styles.storeBar, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.storeBarLeft}>
            <StoreIcon color="#3b82f6" size={18} />
            <View>
              <Text style={[styles.storeName, { color: textColor }]}>{activeStore.name}</Text>
              <Text style={[styles.storeRole, { color: subTextColor }]}>
                Papel na loja: <Text style={styles.bold}>{userRole?.toUpperCase() || 'CONSUMIDOR'}</Text>
              </Text>
            </View>
          </View>

          {userStores.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeSwitcher}>
              {userStores.map((item) => (
                <React.Fragment key={item.store.id}>
                  <TouchableOpacity
                    onPress={() => {
                      setActiveStore(item.store);
                      setUserRole(item.role);
                    }}
                    style={[
                      styles.storeChip,
                      { backgroundColor: activeStore.id === item.store.id ? '#3b82f6' : inputBg },
                    ]}
                  >
                    <Text style={[styles.storeChipText, { color: activeStore.id === item.store.id ? '#ffffff' : textColor }]}>
                      {item.store.name}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Header & Controls */}
      <View style={[styles.headerCard, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.badgeLabel}>GESTÃO DE CATÁLOGO MULTI-LOJA</Text>
            <Text style={[styles.title, { color: textColor }]}>Roupas & Produtos</Text>
          </View>
          {(userRole === 'owner' || userRole === 'manager') && (
            <TouchableOpacity onPress={handleOpenAddModal} style={styles.addBtn}>
              <Plus color="#ffffff" size={16} />
              <Text style={styles.addBtnText}>Nova Peça</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: inputBg }]}>
          <Search color={subTextColor} size={16} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por nome, cor ou estilo..."
            placeholderTextColor={subTextColor}
            style={[styles.searchInput, { color: textColor }]}
          />
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {categories.map((cat) => {
            const isSel = selectedCategory === cat;
            return (
              <React.Fragment key={cat}>
                <TouchableOpacity
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.catPill,
                    {
                      backgroundColor: isSel ? '#3b82f6' : isDark ? '#0f172a' : '#f1f5f9',
                    },
                  ]}
                >
                  <Text style={[styles.catPillText, { color: isSel ? '#ffffff' : subTextColor }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </ScrollView>
      </View>

      {/* Grid */}
      {filteredCatalog.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: cardBg, borderColor }]}>
          <ShoppingBag color={subTextColor} size={36} />
          <Text style={[styles.emptyTitle, { color: textColor }]}>Nenhuma peça encontrada no catálogo</Text>
          <Text style={[styles.emptyText, { color: subTextColor }]}>
            Tente buscar outro termo ou selecione outra categoria.
          </Text>
        </View>
      ) : (
        <View style={styles.gridContainer}>
          {filteredCatalog.map((item) => (
            <React.Fragment key={item.id}>
              <View style={styles.gridItem}>
                <CatalogCard
                  item={item}
                  selected={selectedItem?.id === item.id}
                  onSelect={() => {
                    onSelectGarment(item);
                    onGoToProvador();
                  }}
                  onQuickTryOn={() => {
                    onSelectGarment(item);
                    onGoToProvador();
                  }}
                  onEdit={() => handleOpenEditModal(item)}
                  onDelete={() => handleDeleteItem(item)}
                  canEdit={userRole === 'owner' || userRole === 'manager'}
                  canDelete={userRole === 'owner'}
                  isDark={isDark}
                />
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* Product Form Modal */}
      <ProductFormModal
        visible={showProductModal}
        initialProduct={editingProduct}
        storeId={activeStore?.id || 'demo-store-001'}
        onSave={handleSaveProductFromModal}
        onClose={() => setShowProductModal(false)}
        isDark={isDark}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 12,
  },
  storeBar: {
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '900',
  },
  storeRole: {
    fontSize: 10,
  },
  bold: {
    fontWeight: '800',
    color: '#3b82f6',
  },
  storeSwitcher: {
    flexDirection: 'row',
  },
  storeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 6,
  },
  storeChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headerCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeLabel: {
    color: '#3b82f6',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 12,
  },
  catScroll: {
    flexDirection: 'row',
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  catPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyBox: {
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridItem: {
    width: '50%',
    paddingHorizontal: 6,
  },
});
