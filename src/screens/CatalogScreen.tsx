// src/screens/CatalogScreen.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Search, Sparkles, Tag, Plus, Edit2, Trash2, CheckCircle2 } from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows, formatCurrency } from '../theme';
import { useI18n } from '../i18n';
import { Header } from '../components/Header';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { AdminProductModal } from '../components/AdminProductModal';
import { EmptyState } from '../components/EmptyState';
import { Product, GarmentCategory } from '../types';
import { useCatalog } from '../context/CatalogContext';

export function CatalogScreen({ navigation }: any) {
  const { t } = useI18n();
  const {
    products,
    userRole,
    addProduct,
    editProduct,
    deleteProduct,
    setSelectedTryOnProduct,
  } = useCatalog();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editProductModalVisible, setEditProductModalVisible] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  const isStoreAdmin = userRole === 'owner' || userRole === 'manager';

  const categoryChips = [
    { id: 'all', label: t('allCategories') },
    { id: 'full_body', label: t('catFullBody') },
    { id: 'upper_body', label: t('catUpperBody') },
    { id: 'lower_body', label: t('catLowerBody') },
    { id: 'shoes', label: t('catShoes') },
  ];

  function getCategoryLabel(category: GarmentCategory): string {
    switch (category) {
      case 'full_body':
        return t('catFullBody');
      case 'upper_body':
        return t('catUpperBody');
      case 'lower_body':
        return t('catLowerBody');
      case 'shoes':
        return t('catShoes');
      default:
        return t('allCategories');
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // In customer mode, hide inactive products
      if (!isStoreAdmin && product.active === false) {
        return false;
      }

      const matchesCategory =
        selectedCategory === 'all' || product.category === selectedCategory;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        (product.description && product.description.toLowerCase().includes(q)) ||
        (product.color && product.color.toLowerCase().includes(q)) ||
        (product.material && product.material.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery, isStoreAdmin]);

  function handleOpenDetails(product: Product) {
    setDetailProduct(product);
    setDetailModalVisible(true);
  }

  function handleSelectForTryOn(product: Product) {
    setSelectedTryOnProduct(product);
    if (navigation && navigation.navigate) {
      navigation.navigate('TryOn');
    }
  }

  function handleAddNew() {
    setProductToEdit(null);
    setEditProductModalVisible(true);
  }

  function handleEdit(product: Product) {
    setProductToEdit(product);
    setEditProductModalVisible(true);
  }

  function handleDelete(productId?: string) {
    if (!productId) return;
    Alert.alert(t('deletePieceConfirmTitle'), t('deletePieceConfirmMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteBtn'),
        style: 'destructive',
        onPress: () => {
          deleteProduct(productId);
          Alert.alert(t('success'), t('deleteSuccessMsg'));
        },
      },
    ]);
  }

  function handleSaveProduct(productData: Partial<Product>) {
    if (productData.id) {
      editProduct(productData.id, productData);
    } else {
      addProduct(productData);
    }
    Alert.alert(t('success'), t('productSavedSuccess'));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header />

        {/* Search & Actions Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('searchPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {isStoreAdmin && (
              <TouchableOpacity
                style={styles.addPieceBtn}
                onPress={handleAddNew}
                activeOpacity={0.85}
              >
                <Plus size={16} color={colors.textInverse} />
                <Text style={styles.addPieceBtnText}>{t('addNewPiece')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal Category Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {categoryChips.map(chip => (
              <TouchableOpacity
                key={chip.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === chip.id && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(chip.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === chip.id && styles.categoryChipTextActive,
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Product List */}
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id || item.name}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon={Tag}
              title={t('noSearchResultsTitle')}
              description={t('noSearchResultsDesc')}
            />
          }
          renderItem={({ item }) => {
            const photoUrl =
              item.photos?.find(p => p.type === 'catalog')?.storagePath ||
              'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80';

            return (
              <TouchableOpacity
                style={styles.productCard}
                onPress={() => handleOpenDetails(item)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: photoUrl }} style={styles.productImage} resizeMode="cover" />

                <View style={styles.productInfo}>
                  <View style={styles.productHeaderRow}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {getCategoryLabel(item.category)}
                      </Text>
                    </View>

                    <View style={styles.rightBadgeContainer}>
                      {item.active === false && isStoreAdmin && (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveBadgeText}>{t('statusDisabled')}</Text>
                        </View>
                      )}
                      <View style={styles.stockBadge}>
                        <CheckCircle2 size={10} color={colors.success} />
                        <Text style={styles.stockText}>{item.stock || 1} {t('inStock')}</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.productName} numberOfLines={1}>
                    {item.name}
                  </Text>

                  {item.description ? (
                    <Text style={styles.productDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  <View style={styles.productFooterRow}>
                    <Text style={styles.priceText}>
                      {formatCurrency(item.price, item.currency)}
                    </Text>

                    <View style={styles.actionButtonsRow}>
                      {isStoreAdmin && (
                        <>
                          <TouchableOpacity
                            style={styles.iconActionBtn}
                            onPress={() => handleEdit(item)}
                            activeOpacity={0.7}
                          >
                            <Edit2 size={14} color={colors.accent} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.iconActionBtn, styles.iconDeleteBtn]}
                            onPress={() => handleDelete(item.id)}
                            activeOpacity={0.7}
                          >
                            <Trash2 size={14} color={colors.error} />
                          </TouchableOpacity>
                        </>
                      )}

                      <TouchableOpacity
                        style={styles.tryOnQuickBtn}
                        onPress={() => handleSelectForTryOn(item)}
                        activeOpacity={0.8}
                      >
                        <Sparkles size={12} color={colors.textInverse} />
                        <Text style={styles.tryOnQuickBtnText}>{t('tryOnTab')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* Product Detail Modal */}
        <ProductDetailModal
          visible={detailModalVisible}
          product={detailProduct}
          canEdit={isStoreAdmin}
          onClose={() => setDetailModalVisible(false)}
          onSelectForTryOn={handleSelectForTryOn}
          onEdit={handleEdit}
        />

        {/* Add/Edit Product Modal */}
        <AdminProductModal
          visible={editProductModalVisible}
          product={productToEdit}
          onClose={() => setEditProductModalVisible(false)}
          onSave={handleSaveProduct}
          onDelete={handleDelete}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    height: 40,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
  },
  addPieceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  addPieceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textInverse,
  },
  categoryScroll: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.card,
  },
  productImage: {
    width: 115,
    height: 145,
    backgroundColor: colors.surfaceLight,
  },
  productInfo: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  productHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.xs,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  rightBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inactiveBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  inactiveBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.error,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stockText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.success,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  productDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  productFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDeleteBtn: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  tryOnQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  tryOnQuickBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
});
