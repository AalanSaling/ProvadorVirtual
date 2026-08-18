// src/screens/TryOnScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  Camera,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Check,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows, formatCurrency } from '../theme';
import { useI18n } from '../i18n';
import { Header } from '../components/Header';
import { TryOnLoadingModal } from '../components/TryOnLoadingModal';
import { TryOnResultModal } from '../components/TryOnResultModal';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { Product, TryOnResult, MultiProviderTryOnResponse } from '../types';
import { useCatalog } from '../context/CatalogContext';

export function TryOnScreen({ route }: any) {
  const { t } = useI18n();
  const { products, selectedTryOnProduct, setSelectedTryOnProduct, userRole } = useCatalog();

  const [personImage, setPersonImage] = useState<string | null>(null);
  const [personQuality, setPersonQuality] = useState<{ valid: boolean; humanMessage: string } | null>(null);
  const [validatingPerson, setValidatingPerson] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeResult, setActiveResult] = useState<TryOnResult | null>(null);
  const [storeProviders, setStoreProviders] = useState<{ id: string; name: string; configured: boolean }[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  // If a product is passed through route navigation (from Catalog)
  useEffect(() => {
    if (route?.params?.selectedProduct) {
      setSelectedTryOnProduct(route.params.selectedProduct);
    }
  }, [route?.params?.selectedProduct, setSelectedTryOnProduct]);

  // Filter available active products for try on
  const availableProducts = products.filter(p => p.active !== false);
  const currentProduct = selectedTryOnProduct;

  // Load configured providers dynamically for the selected product's store
  useEffect(() => {
    let isMounted = true;
    async function loadStoreProviders() {
      if (!currentProduct?.storeId) {
        if (isMounted) {
          setStoreProviders([]);
          setSelectedProviders([]);
        }
        return;
      }

      try {
        const res = await fetch(`/api/store/${currentProduct.storeId}/providers`);
        if (res.ok) {
          const data = await res.json();
          const configured = (data.providers || []).filter((p: any) => p.configured);
          if (isMounted) {
            setStoreProviders(configured);
            if (configured.length > 0) {
              const defaultP = configured.find((p: any) => p.id === data.defaultProvider);
              setSelectedProviders(defaultP ? [defaultP.id] : [configured[0].id]);
            } else {
              setSelectedProviders([]);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setStoreProviders([]);
          setSelectedProviders([]);
        }
      }
    }

    loadStoreProviders();
    return () => {
      isMounted = false;
    };
  }, [currentProduct?.storeId]);

  function toggleProvider(providerId: string) {
    setSelectedProviders(prev => {
      if (prev.includes(providerId)) {
        return prev.filter(id => id !== providerId);
      } else {
        return [...prev, providerId];
      }
    });
  }

  // Pick image from gallery
  async function pickImageFromGallery() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        await processAndSetImage(uri);
      }
    } catch (e) {
      console.warn('Error launching image library:', e);
    }
  }

  // Pick image from camera
  async function takePhotoFromCamera() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('error'), 'Permissão da câmera é necessária.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        await processAndSetImage(uri);
      }
    } catch (e) {
      console.warn('Error launching camera:', e);
    }
  }

  async function processAndSetImage(uri: string) {
    let finalUri = uri;
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 768 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      finalUri = manipResult.uri;
      setPersonImage(finalUri);
    } catch {
      setPersonImage(uri);
    }

    // Run person quality check
    setValidatingPerson(true);
    try {
      const res = await fetch('/api/try-on/person/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personImage: finalUri }),
      });
      if (res.ok) {
        const qualityData = await res.json();
        setPersonQuality(qualityData);
      } else {
        setPersonQuality({
          valid: false,
          humanMessage: 'Não foi possível verificar sua foto. Tente novamente com uma foto nítida e bem iluminada.',
        });
      }
    } catch {
      setPersonQuality({
        valid: false,
        humanMessage: 'Não foi possível verificar sua foto. Tente novamente.',
      });
    } finally {
      setValidatingPerson(false);
    }
  }

  // Execute Virtual Try-On
  async function handleExecuteTryOn() {
    if (!personImage) {
      Alert.alert(t('photoMissingAlertTitle'), t('photoMissingAlertMsg'));
      return;
    }

    if (personQuality && !personQuality.valid) {
      Alert.alert(t('error') || 'Foto inválida', personQuality.humanMessage || 'Não foi possível verificar sua foto. Tente novamente.');
      return;
    }

    if (!currentProduct) {
      Alert.alert(t('garmentMissingAlertTitle'), t('garmentMissingAlertMsg'));
      return;
    }

    const storeId = currentProduct.storeId;
    if (!storeId) {
      Alert.alert(t('error') || 'Erro', 'Não foi possível identificar a loja desta peça.');
      return;
    }

    const referencePhoto = currentProduct.photos?.find(p => p.type === 'try_on_reference')?.storagePath;

    if (!referencePhoto) {
      Alert.alert(t('tryOnErrorTitle'), t('garmentNotReadyMsg'));
      return;
    }

    if (selectedProviders.length === 0) {
      Alert.alert(
        t('noAIEngineConnectedNotice') || 'Nenhum motor de IA selecionado',
        'Selecione ou configure ao menos um motor de IA ativo para esta loja.'
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        storeId,
        productId: currentProduct.id,
        personImage,
        selectedProviders,
      };

      const response = await fetch('/api/try-on/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const userMsg = errJson.message || t('tryOnErrorMsg');
        Alert.alert(t('tryOnErrorTitle'), userMsg);
        return;
      }

      const data: MultiProviderTryOnResponse = await response.json();
      const firstSuccess = data.results?.find(r => r.status === 'success' && r.resultImage);

      if (firstSuccess) {
        setActiveResult(firstSuccess);
        setResultModalVisible(true);
      } else {
        const failedItem = data.results?.find(r => r.status === 'failed');
        const reason = failedItem?.errorMessage || t('tryOnErrorMsg');
        Alert.alert(t('tryOnErrorTitle'), reason);
      }
    } catch (err: any) {
      Alert.alert(t('tryOnErrorTitle'), err.message || t('tryOnErrorMsg'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* PASSO 1: FOTO DA PESSOA */}
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View>
                <Text style={styles.stepTitle}>{t('tryOnStep1Title')}</Text>
                <Text style={styles.stepSubtitle}>{t('tryOnStep1Subtitle')}</Text>
              </View>
            </View>

            {personImage ? (
              <View style={styles.photoPreviewCard}>
                <Image source={{ uri: personImage }} style={styles.personPhoto} resizeMode="cover" />
                <View style={styles.photoOverlay}>
                  <TouchableOpacity
                    style={styles.changePhotoBtn}
                    onPress={pickImageFromGallery}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={14} color={colors.textPrimary} />
                    <Text style={styles.changePhotoText}>{t('changePhoto')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.uploadCard}>
                <View style={styles.uploadActionsRow}>
                  <TouchableOpacity
                    style={styles.actionPill}
                    onPress={takePhotoFromCamera}
                    activeOpacity={0.8}
                  >
                    <Camera size={18} color={colors.accent} />
                    <Text style={styles.actionPillText}>{t('takePhoto')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionPill, styles.actionPillSecondary]}
                    onPress={pickImageFromGallery}
                    activeOpacity={0.8}
                  >
                    <ImageIcon size={18} color={colors.textPrimary} />
                    <Text style={styles.actionPillTextSecondary}>{t('pickFromGallery')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Person Quality Feedback */}
            {personImage && personQuality && (
              <View
                style={{
                  marginTop: spacing.sm,
                  padding: spacing.sm,
                  borderRadius: borderRadius.sm,
                  backgroundColor: personQuality.valid ? '#F0FDF4' : '#FEF2F2',
                  borderWidth: 1,
                  borderColor: personQuality.valid ? '#BBF7D0' : '#FECACA',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Check size={14} color={personQuality.valid ? '#16A34A' : '#DC2626'} />
                <Text
                  style={{
                    fontSize: 11,
                    color: personQuality.valid ? '#15803D' : '#B91C1C',
                    fontWeight: '600',
                    flex: 1,
                  }}
                >
                  {personQuality.humanMessage}
                </Text>
              </View>
            )}
          </View>

          {/* PASSO 2: ESCOLHA DA PEÇA */}
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View>
                <Text style={styles.stepTitle}>{t('tryOnStep2Title')}</Text>
                <Text style={styles.stepSubtitle}>{t('tryOnStep2Subtitle')}</Text>
              </View>
            </View>

            {/* Horizontal Garment Carousel */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.garmentCarousel}
            >
              {availableProducts.map(product => {
                const isSelected = currentProduct?.id === product.id;
                const photoUrl =
                  product.photos?.find(p => p.type === 'catalog')?.storagePath ||
                  product.photos?.find(p => p.type === 'try_on_reference')?.storagePath ||
                  '';

                return (
                  <TouchableOpacity
                    key={product.id}
                    style={[
                      styles.garmentCard,
                      isSelected && styles.garmentCardSelected,
                    ]}
                    onPress={() => setSelectedTryOnProduct(product)}
                    activeOpacity={0.85}
                  >
                    {photoUrl ? (
                      <Image source={{ uri: photoUrl }} style={styles.garmentImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.garmentImage, { backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center' }]}>
                        <ImageIcon size={24} color={colors.textTertiary} />
                      </View>
                    )}

                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Check size={11} color={colors.textInverse} />
                        <Text style={styles.selectedBadgeText}>{t('selectedBadge')}</Text>
                      </View>
                    )}

                    <View style={styles.garmentInfo}>
                      <Text style={styles.garmentName} numberOfLines={1}>
                        {product.name}
                      </Text>
                      <Text style={styles.garmentPrice}>
                        {formatCurrency(product.price, product.currency)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Selected Garment Details Bar */}
            {currentProduct ? (
              <View style={styles.selectedSummaryCard}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryLabel}>{currentProduct.name}</Text>
                  <Text style={styles.summaryPrice}>
                    {formatCurrency(currentProduct.price, currentProduct.currency)} · {currentProduct.color || 'Coleção'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.detailsBtn}
                  onPress={() => setDetailModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailsBtnText}>{t('viewDetails')}</Text>
                  <ChevronRight size={13} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noSelectionNotice}>
                <AlertTriangle size={14} color={colors.textTertiary} />
                <Text style={styles.noSelectionText}>
                  {t('garmentMissingAlertMsg')}
                </Text>
              </View>
            )}

            {/* AI Providers Selection */}
            {currentProduct && (
              <View style={styles.providerSection}>
                <Text style={styles.providerSectionTitle}>Motores de IA da Loja</Text>
                {storeProviders.length > 0 ? (
                  <View style={styles.providerPillsRow}>
                    {storeProviders.map(p => {
                      const isSelected = selectedProviders.includes(p.id);
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.providerPill,
                            isSelected && styles.providerPillActive,
                          ]}
                          onPress={() => toggleProvider(p.id)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.providerCheckbox,
                              isSelected && styles.providerCheckboxActive,
                            ]}
                          >
                            {isSelected && <Check size={10} color={colors.textInverse} />}
                          </View>
                          <Text
                            style={[
                              styles.providerPillText,
                              isSelected && styles.providerPillTextActive,
                            ]}
                          >
                            {p.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.noProvidersWarning}>
                    <AlertTriangle size={12} color="#D97706" />
                    <Text style={styles.noProvidersWarningText}>
                      Nenhum motor de IA conectado para esta loja. Configure chaves no painel admin.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* PASSO 3: CTA PRINCIPAL */}
        <View style={styles.footerCTAContainer}>
          <TouchableOpacity
            style={[
              styles.primaryCtaButton,
              loading && styles.primaryCtaDisabled,
            ]}
            onPress={handleExecuteTryOn}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Sparkles size={18} color={colors.textInverse} />
            <Text style={styles.primaryCtaText}>{t('tryOnStep3Cta')}</Text>
          </TouchableOpacity>
        </View>

        {/* Loading Modal */}
        <TryOnLoadingModal visible={loading} />

        {/* Result Modal */}
        <TryOnResultModal
          visible={resultModalVisible}
          result={activeResult}
          productName={currentProduct?.name}
          onClose={() => setResultModalVisible(false)}
          onPickAnotherGarment={() => {
            setResultModalVisible(false);
          }}
          onChangePhoto={() => {
            setResultModalVisible(false);
            pickImageFromGallery();
          }}
        />

        {/* Product Detail Modal */}
        <ProductDetailModal
          visible={detailModalVisible}
          product={currentProduct}
          canEdit={userRole !== 'customer'}
          onClose={() => setDetailModalVisible(false)}
          onSelectForTryOn={prod => setSelectedTryOnProduct(prod)}
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
    justifyContent: 'space-between',
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  stepContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    ...shadows.card,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stepSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  uploadCard: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  uploadActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 12,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: borderRadius.md,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  actionPillSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  actionPillTextSecondary: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  photoPreviewCard: {
    height: 200,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  personPhoto: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceGlass,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  changePhotoText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  garmentCarousel: {
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  garmentCard: {
    width: 130,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    position: 'relative',
  },
  garmentCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceLighter,
    ...shadows.cardHover,
  },
  garmentImage: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surface,
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  selectedBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  garmentInfo: {
    padding: spacing.sm,
  },
  garmentName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  garmentPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 2,
  },
  selectedSummaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryPrice: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  footerCTAContainer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: borderRadius.md,
    ...shadows.card,
  },
  primaryCtaDisabled: {
    opacity: 0.6,
  },
  primaryCtaText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textInverse,
    letterSpacing: 1.2,
  },
  noSelectionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noSelectionText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  providerSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  providerSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  providerPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  providerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  providerPillActive: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  providerCheckbox: {
    width: 14,
    height: 14,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  providerCheckboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  providerPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  providerPillTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  noProvidersWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: '#FEF3C7',
  },
  noProvidersWarningText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
  },
});
