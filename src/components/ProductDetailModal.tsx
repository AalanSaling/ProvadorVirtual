// src/components/ProductDetailModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { X, Sparkles, Tag, CheckCircle2, Edit2, Info } from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows, formatCurrency } from '../theme';
import { useI18n } from '../i18n';
import { Product, GarmentCategory } from '../types';

interface ProductDetailModalProps {
  visible: boolean;
  product: Product | null;
  canEdit?: boolean;
  onClose: () => void;
  onSelectForTryOn: (product: Product) => void;
  onEdit?: (product: Product) => void;
}

export function ProductDetailModal({
  visible,
  product,
  canEdit = false,
  onClose,
  onSelectForTryOn,
  onEdit,
}: ProductDetailModalProps) {
  const { t } = useI18n();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activePhotoType, setActivePhotoType] = useState<'catalog' | 'try_on_reference'>('catalog');

  if (!visible || !product) return null;

  const catalogPhoto =
    product.photos?.find(p => p.type === 'catalog')?.storagePath ||
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80';

  const referencePhoto =
    product.photos?.find(p => p.type === 'try_on_reference')?.storagePath || catalogPhoto;

  const currentPhoto = activePhotoType === 'catalog' ? catalogPhoto : referencePhoto;

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

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('productDetailsTitle')}</Text>
            {canEdit && onEdit ? (
              <TouchableOpacity
                style={styles.editHeaderBtn}
                onPress={() => {
                  onClose();
                  onEdit(product);
                }}
                activeOpacity={0.7}
              >
                <Edit2 size={16} color={colors.accent} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 34 }} />
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* Main Product Image Carousel / Switcher */}
            <View style={styles.imageWrapper}>
              <Image source={{ uri: currentPhoto }} style={styles.mainImage} resizeMode="cover" />

              {/* Photo Type Switcher Tabs */}
              <View style={styles.photoSwitcher}>
                <TouchableOpacity
                  style={[
                    styles.photoSwitchTab,
                    activePhotoType === 'catalog' && styles.photoSwitchTabActive,
                  ]}
                  onPress={() => setActivePhotoType('catalog')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.photoSwitchText,
                      activePhotoType === 'catalog' && styles.photoSwitchTextActive,
                    ]}
                  >
                    {t('catalogPhotoTab')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.photoSwitchTab,
                    activePhotoType === 'try_on_reference' && styles.photoSwitchTabActive,
                  ]}
                  onPress={() => setActivePhotoType('try_on_reference')}
                  activeOpacity={0.8}
                >
                  <Sparkles
                    size={11}
                    color={activePhotoType === 'try_on_reference' ? colors.accent : colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.photoSwitchText,
                      activePhotoType === 'try_on_reference' && styles.photoSwitchTextActive,
                    ]}
                  >
                    {t('tryOnPhotoTab')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.photoHelpCard}>
                <Info size={12} color={colors.accent} />
                <Text style={styles.photoHelpText}>
                  {activePhotoType === 'catalog' ? t('catalogPhotoHelp') : t('tryOnPhotoHelp')}
                </Text>
              </View>
            </View>

            {/* Product Info */}
            <View style={styles.detailsBody}>
              <View style={styles.categoryBadge}>
                <Tag size={11} color={colors.accent} />
                <Text style={styles.categoryBadgeText}>
                  {getCategoryLabel(product.category)}
                </Text>
              </View>

              <Text style={styles.productTitle}>{product.name}</Text>
              <Text style={styles.priceTag}>
                {formatCurrency(product.price, product.currency)}
              </Text>

              {product.description ? (
                <Text style={styles.descriptionText}>{product.description}</Text>
              ) : null}

              {/* Sizes */}
              {product.sizes && product.sizes.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('sizesLabel')}</Text>
                  <View style={styles.sizeRow}>
                    {product.sizes.map((size) => (
                      <TouchableOpacity
                        key={size}
                        style={[
                          styles.sizeBadge,
                          selectedSize === size && styles.sizeBadgeActive,
                        ]}
                        onPress={() => setSelectedSize(size)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.sizeText,
                            selectedSize === size && styles.sizeTextActive,
                          ]}
                        >
                          {size}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Specifications Card */}
              <View style={styles.specsCard}>
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>{t('categoryLabel')}</Text>
                  <Text style={styles.specValue}>{getCategoryLabel(product.category)}</Text>
                </View>
                {product.color ? (
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>{t('colorLabel')}</Text>
                    <Text style={styles.specValue}>{product.color}</Text>
                  </View>
                ) : null}
                {product.material ? (
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>{t('materialLabel')}</Text>
                    <Text style={styles.specValue}>{product.material}</Text>
                  </View>
                ) : null}
                {product.fit ? (
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>{t('fitLabel')}</Text>
                    <Text style={styles.specValue}>{product.fit}</Text>
                  </View>
                ) : null}
                <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.specLabel}>{t('stockLabel')}</Text>
                  <View style={styles.stockBadge}>
                    <CheckCircle2 size={11} color={colors.success} />
                    <Text style={styles.stockText}>{product.stock || 1} {t('units')} ({t('inStock')})</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer CTA */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => {
                onSelectForTryOn(product);
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Sparkles size={16} color={colors.textInverse} />
              <Text style={styles.ctaButtonText}>{t('tryThisGarmentBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
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
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  imageWrapper: {
    padding: spacing.md,
    alignItems: 'center',
  },
  mainImage: {
    width: '100%',
    height: 320,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  photoSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: 3,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    width: '100%',
  },
  photoSwitchTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
  },
  photoSwitchTabActive: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  photoSwitchText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  photoSwitchTextActive: {
    color: colors.accent,
  },
  photoHelpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  photoHelpText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  detailsBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentGlow,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xs,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  productTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  priceTag: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.md,
  },
  descriptionText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  sizeBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sizeBadgeActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  sizeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sizeTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  specsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  specLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  specValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  footer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    ...shadows.card,
  },
  ctaButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 0.8,
  },
});
