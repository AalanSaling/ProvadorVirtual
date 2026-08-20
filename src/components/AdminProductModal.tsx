// src/components/AdminProductModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
import { X, Sparkles, Image as ImageIcon, Check, Trash2, Eye } from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { useI18n } from '../i18n';
import { Product, GarmentCategory, CurrencyCode } from '../types';
import { authenticatedFetch } from '../lib/authenticatedFetch';
import { useCatalog } from '../context/CatalogContext';

interface AdminProductModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onSave: (product: Partial<Product>) => void;
  onDelete?: (productId: string) => void;
}

const CURRENCIES: CurrencyCode[] = ['BRL', 'PYG', 'USD', 'EUR'];

export function AdminProductModal({
  visible,
  product,
  onClose,
  onSave,
  onDelete,
}: AdminProductModalProps) {
  const { t } = useI18n();
  const { currentStoreId } = useCatalog();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GarmentCategory>('full_body');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('BRL');
  const [color, setColor] = useState('');
  const [material, setMaterial] = useState('');
  const [fit, setFit] = useState('');
  const [sizes, setSizes] = useState('');
  const [stock, setStock] = useState('10');
  const [active, setActive] = useState(true);
  const [catalogPhotoUrl, setCatalogPhotoUrl] = useState('');
  const [referencePhotoUrl, setReferencePhotoUrl] = useState('');
  const [isPreparingGarment, setIsPreparingGarment] = useState(false);
  const [preparationInfo, setPreparationInfo] = useState<any | null>(null);

  const CATEGORIES: { label: string; value: GarmentCategory }[] = [
    { label: t('catFullBody'), value: 'full_body' },
    { label: t('catUpperBody'), value: 'upper_body' },
    { label: t('catLowerBody'), value: 'lower_body' },
    { label: t('catShoes'), value: 'shoes' },
  ];

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setDescription(product.description || '');
      setCategory(product.category || 'full_body');
      setPrice(product.price ? product.price.toString() : '');
      setCurrency(product.currency || 'BRL');
      setColor(product.color || '');
      setMaterial(product.material || '');
      setFit(product.fit || '');
      setSizes(product.sizes ? product.sizes.join(', ') : 'P, M, G');
      setStock(product.stock !== undefined ? product.stock.toString() : '10');
      setActive(product.active !== undefined ? product.active : true);

      const catPhoto = product.photos?.find(p => p.type === 'catalog')?.storagePath || '';
      const refPhoto = product.photos?.find(p => p.type === 'try_on_reference')?.storagePath || '';
      setCatalogPhotoUrl(catPhoto);
      setReferencePhotoUrl(refPhoto);
      setPreparationInfo(null);
    } else {
      setName('');
      setDescription('');
      setCategory('full_body');
      setPrice('');
      setCurrency('BRL');
      setColor('');
      setMaterial('');
      setFit('');
      setSizes('P, M, G');
      setStock('10');
      setActive(true);
      setCatalogPhotoUrl('');
      setReferencePhotoUrl('');
      setPreparationInfo(null);
    }
  }, [product, visible]);

  async function handleTriggerAIGarmentPreparation() {
    if (!product?.id) {
      Alert.alert(t('error'), 'Salve o produto primeiro antes de executar a preparação com IA.');
      return;
    }
    if (!catalogPhotoUrl.trim()) {
      Alert.alert(t('error'), 'Forneça uma foto de catálogo para processar a preparação visual.');
      return;
    }

    const targetStoreId = product.storeId || currentStoreId;

    setIsPreparingGarment(true);
    try {
      const res = await authenticatedFetch(`/api/products/${product.id}/prepare-garment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: targetStoreId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Falha ao processar preparação da peça');
      }

      const data = await res.json();
      setPreparationInfo(data);
      if (data.preparedImageUrl) {
        setReferencePhotoUrl(data.preparedImageUrl);
        Alert.alert(
          'Preparação IA Concluída',
          'A roupa foi isolada com sucesso e validada pelo Quality Gate para o provador virtual.'
        );
      }
    } catch (e: any) {
      Alert.alert('Erro na Preparação', e.message || 'Não foi possível isolar a peça.');
    } finally {
      setIsPreparingGarment(false);
    }
  }

  function handleSave() {
    if (!name.trim()) {
      Alert.alert(t('error'), t('invalidNameAlert'));
      return;
    }
    const numPrice = parseFloat(price.replace(',', '.'));
    if (isNaN(numPrice) || numPrice <= 0) {
      Alert.alert(t('error'), t('invalidPriceAlert'));
      return;
    }

    const photosList = [];
    if (catalogPhotoUrl.trim()) {
      photosList.push({ type: 'catalog' as const, storagePath: catalogPhotoUrl.trim() });
    }
    if (referencePhotoUrl.trim()) {
      photosList.push({ type: 'try_on_reference' as const, storagePath: referencePhotoUrl.trim() });
    } else if (catalogPhotoUrl.trim()) {
      photosList.push({ type: 'try_on_reference' as const, storagePath: catalogPhotoUrl.trim() });
    }

    const parsedSizes = sizes
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    onSave({
      id: product?.id,
      name: name.trim(),
      description: description.trim(),
      category,
      price: numPrice,
      currency,
      color: color.trim() || undefined,
      material: material.trim() || undefined,
      fit: fit.trim() || undefined,
      sizes: parsedSizes.length > 0 ? parsedSizes : ['P', 'M', 'G'],
      stock: parseInt(stock, 10) || 1,
      active,
      photos: photosList.length > 0 ? photosList : undefined,
    });

    onClose();
  }

  function handleDelete() {
    if (!product?.id || !onDelete) return;
    Alert.alert(t('deletePieceConfirmTitle'), t('deletePieceConfirmMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteBtn'),
        style: 'destructive',
        onPress: () => {
          onDelete(product.id!);
          onClose();
        },
      },
    ]);
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
            <Text style={styles.headerTitle}>
              {product ? t('editProductModalTitle') : t('newProductModalTitle')}
            </Text>
            <TouchableOpacity style={styles.saveHeaderButton} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveHeaderText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('productNameLabel')} *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('productNamePlaceholder')}
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Price & Currency */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1.5 }]}>
                <Text style={styles.label}>{t('productPriceLabel')} *</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="289.90"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>{t('productCurrencyLabel')}</Text>
                <View style={styles.currencyRow}>
                  {CURRENCIES.map(curr => (
                    <TouchableOpacity
                      key={curr}
                      style={[
                        styles.currencyPill,
                        currency === curr && styles.currencyPillActive,
                      ]}
                      onPress={() => setCurrency(curr)}
                    >
                      <Text
                        style={[
                          styles.currencyText,
                          currency === curr && styles.currencyTextActive,
                        ]}
                      >
                        {curr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('productCategoryLabel')}</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryOption,
                      category === cat.value && styles.categoryOptionActive,
                    ]}
                    onPress={() => setCategory(cat.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        category === cat.value && styles.categoryOptionTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('productDescLabel')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('productDescPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Color & Material */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>{t('productColorLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={color}
                  onChangeText={setColor}
                  placeholder="Ex: Preto Noir"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>{t('productMaterialLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={material}
                  onChangeText={setMaterial}
                  placeholder="Ex: Seda 100%"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            {/* Fit & Stock */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>{t('productFitLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={fit}
                  onChangeText={setFit}
                  placeholder="Ex: Slim / Regular"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>{t('productStockLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={stock}
                  onChangeText={setStock}
                  placeholder="10"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Sizes */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('productSizesLabel')}</Text>
              <TextInput
                style={styles.input}
                value={sizes}
                onChangeText={setSizes}
                placeholder="PP, P, M, G, GG"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Active Toggle */}
            <View style={styles.switchCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>{t('productAvailabilityLabel')}</Text>
                <Text style={styles.switchDesc}>{t('productActiveToggle')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                onPress={() => setActive(!active)}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {active ? t('statusActive') : t('statusDisabled')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* FOTO DA PEÇA (CATÁLOGO) */}
            <View style={styles.photoSectionCard}>
              <View style={styles.photoSectionHeader}>
                <ImageIcon size={16} color={colors.accent} />
                <Text style={styles.photoSectionTitle}>Foto da Peça (Catálogo)</Text>
              </View>
              <Text style={styles.photoSectionHelp}>
                Cole a URL da foto da peça no catálogo. O provador virtual preparará a imagem automaticamente para você.
              </Text>

              <TextInput
                style={[styles.input, { marginTop: spacing.sm }]}
                value={catalogPhotoUrl}
                onChangeText={setCatalogPhotoUrl}
                placeholder="https://exemplo.com/fotos/vestido.jpg"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* STATUS E PREPARAÇÃO AUTOMÁTICA DA ROUPA */}
            {catalogPhotoUrl.trim() ? (
              <View style={styles.aiActionCard}>
                <View style={styles.aiActionHeader}>
                  <Sparkles size={16} color={colors.accentDark} />
                  <Text style={styles.aiActionTitle}>Status para o Provador Virtual</Text>
                </View>

                {/* Status Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 }}>
                  {referencePhotoUrl ? (
                    <View style={styles.gateBadge}>
                      <Check size={13} color="#15803D" />
                      <Text style={styles.gateBadgeText}>PRONTA PARA PROVAR</Text>
                    </View>
                  ) : isPreparingGarment ? (
                    <View style={[styles.gateBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.gateBadgeText, { color: '#B45309' }]}>PREPARANDO PEÇA...</Text>
                    </View>
                  ) : (
                    <View style={[styles.gateBadge, { backgroundColor: '#F3F4F6' }]}>
                      <Text style={[styles.gateBadgeText, { color: '#4B5563' }]}>PREPARAÇÃO AUTOMÁTICA AO SALVAR</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.aiActionDesc}>
                  {referencePhotoUrl
                    ? 'A peça foi isolada e validada pelo Quality Gate com modelo removido e fundo neutro.'
                    : 'A roupa é tratada e isolada de forma 100% transparente pelo motor de IA.'}
                </Text>

                {product?.id && (
                  <TouchableOpacity
                    style={[styles.aiActionBtn, isPreparingGarment && styles.aiActionBtnDisabled]}
                    onPress={handleTriggerAIGarmentPreparation}
                    disabled={isPreparingGarment}
                    activeOpacity={0.85}
                  >
                    {isPreparingGarment ? (
                      <Text style={styles.aiActionBtnText}>Preparando Peça com IA...</Text>
                    ) : (
                      <>
                        <Sparkles size={14} color={colors.textInverse} />
                        <Text style={styles.aiActionBtnText}>
                          {referencePhotoUrl ? 'Atualizar Preparação IA' : 'Preparar Peça com IA Agora'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* VISUAL PREVIEW */}
            {(catalogPhotoUrl || referencePhotoUrl) && (
              <View style={styles.comparisonCard}>
                <Text style={styles.comparisonTitle}>Prévia Visual</Text>
                <View style={styles.comparisonGrid}>
                  {/* Original Photo */}
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Foto do Catálogo</Text>
                    {catalogPhotoUrl ? (
                      <View style={styles.imagePreviewWrapper}>
                        <Image source={{ uri: catalogPhotoUrl }} style={styles.imagePreview} resizeMode="cover" />
                      </View>
                    ) : (
                      <View style={styles.emptyPreviewBox}>
                        <Text style={styles.emptyPreviewText}>Sem foto</Text>
                      </View>
                    )}
                  </View>

                  {/* Prepared Reference */}
                  {referencePhotoUrl && (
                    <View style={styles.comparisonItem}>
                      <Text style={[styles.comparisonLabel, { color: colors.accentDark, fontWeight: '700' }]}>
                        Isolamento para o Provador
                      </Text>
                      <View style={[styles.imagePreviewWrapper, { borderColor: colors.accentDark, borderWidth: 1.5 }]}>
                        <Image source={{ uri: referencePhotoUrl }} style={styles.imagePreview} resizeMode="cover" />
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Delete button (only when editing) */}
            {product?.id && onDelete && (
              <TouchableOpacity style={styles.deletePieceBtn} onPress={handleDelete} activeOpacity={0.8}>
                <Trash2 size={16} color={colors.error} />
                <Text style={styles.deletePieceBtnText}>{t('deleteBtn')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Bottom Save Action */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Check size={16} color={colors.textInverse} />
              <Text style={styles.saveBtnText}>{t('saveProductBtn')}</Text>
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
    letterSpacing: 0.5,
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
  saveHeaderButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  saveHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textInverse,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 4,
  },
  currencyPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  currencyPillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  currencyText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  currencyTextActive: {
    color: colors.accent,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  categoryOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  categoryOptionText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryOptionTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  switchTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  switchDesc: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  toggleBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  toggleTextActive: {
    color: colors.textInverse,
  },
  photoSectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  photoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  photoSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  photoSectionHelp: {
    fontSize: 11,
    color: colors.textTertiary,
    lineHeight: 16,
  },
  imagePreviewWrapper: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    height: 140,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  aiActionCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  aiActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  aiActionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B21A8',
  },
  aiActionDesc: {
    fontSize: 11,
    color: '#7E22CE',
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  aiActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7E22CE',
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
  },
  aiActionBtnDisabled: {
    opacity: 0.6,
  },
  aiActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  comparisonCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  comparisonTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  comparisonItem: {
    flex: 1,
  },
  comparisonLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptyPreviewBox: {
    height: 140,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  emptyPreviewText: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  qualityGateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  gateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  gateBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#15803D',
  },
  deletePieceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  deletePieceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.error,
  },
  footer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    ...shadows.card,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 0.8,
  },
});
