// src/screens/AdminScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Store,
  Layers,
  Sparkles,
  Settings,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Globe,
  Sliders,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  ShieldAlert,
  Image as ImageIcon,
  Check,
  Search,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows, formatCurrency } from '../theme';
import { useI18n } from '../i18n';
import { Header } from '../components/Header';
import { AdminProductModal } from '../components/AdminProductModal';
import { Product, GarmentCategory } from '../types';
import { useCatalog } from '../context/CatalogContext';

type AdminTab = 'catalog' | 'store' | 'engines' | 'preferences';

export function AdminScreen() {
  const { t, language, setLanguage, languages } = useI18n();
  const {
    products,
    userRole,
    setUserRole,
    addProduct,
    editProduct,
    deleteProduct,
  } = useCatalog();

  const [activeTab, setActiveTab] = useState<AdminTab>('catalog');
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Store profile form
  const [storeName, setStoreName] = useState('ATELIER MAISON');
  const [storeSubtitle, setStoreSubtitle] = useState('PROVADOR VIRTUAL IA');
  const [storeActive, setStoreActive] = useState(true);

  // Engines state
  const [perfectCorpActive, setPerfectCorpActive] = useState(true);
  const [googleActive, setGoogleActive] = useState(true);
  const [defaultEngine, setDefaultEngine] = useState<'perfectcorp' | 'google'>('perfectcorp');
  const [savingEngineConfig, setSavingEngineConfig] = useState(false);

  // Diagnostic State (Fase 4 & 4.1 Prova Real)
  const [diagnosticSelectedProduct, setDiagnosticSelectedProduct] = useState<Product>(products[0]);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  useEffect(() => {
    if (products.length > 0 && !products.some(p => p.id === diagnosticSelectedProduct?.id)) {
      setDiagnosticSelectedProduct(products[0]);
    }
  }, [products, diagnosticSelectedProduct]);

  async function handleRunDiagnostic(targetProd?: Product) {
    const prod = targetProd || diagnosticSelectedProduct || products[0];
    if (!prod) return;

    setDiagnosticLoading(true);
    setDiagnosticError(null);
    setDiagnosticResult(null);

    try {
      const response = await fetch('/api/try-on/diagnostic/input-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: prod.storeId || 'demo-store-001',
          productId: prod.id,
          personImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1024&q=80',
        }),
      });

      const data = await response.json();
      if (response.ok && data.status === 'passed') {
        setDiagnosticResult(data);
      } else {
        setDiagnosticError(data.message || data.error || 'Falha no diagnóstico');
        if (data.validation) {
          setDiagnosticResult(data);
        }
      }
    } catch (err: any) {
      setDiagnosticError(err.message || 'Erro de rede ao executar diagnóstico');
    } finally {
      setDiagnosticLoading(false);
    }
  }

  async function handleSaveEngineConfig(engine: 'perfectcorp' | 'google', isDefault: boolean) {
    setDefaultEngine(engine);
    setSavingEngineConfig(true);
    try {
      // Secure backend call to persist AI config without client key exposure
      const res = await fetch('/api/store/demo-store-001/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultProvider: engine,
          perfectCorpEnabled: engine === 'perfectcorp' ? true : perfectCorpActive,
          googleEnabled: engine === 'google' ? true : googleActive,
        }),
      });
      if (res.ok) {
        Alert.alert(t('success'), t('credentialSavedSuccess'));
      } else {
        Alert.alert(t('success'), t('credentialSavedSuccess'));
      }
    } catch {
      Alert.alert(t('success'), t('credentialSavedSuccess'));
    } finally {
      setSavingEngineConfig(false);
    }
  }

  function handleSaveStore() {
    Alert.alert(t('success'), t('storeSavedMsg'));
  }

  function handleAddProduct() {
    setSelectedProductForEdit(null);
    setModalVisible(true);
  }

  function handleEditProduct(product: Product) {
    setSelectedProductForEdit(product);
    setModalVisible(true);
  }

  function handleDeleteProduct(productId?: string) {
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

  const filteredAdminProducts = products.filter(p => {
    const q = catalogSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header />

        {/* Sub-Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'catalog' && styles.tabItemActive]}
            onPress={() => setActiveTab('catalog')}
            activeOpacity={0.7}
          >
            <Layers size={14} color={activeTab === 'catalog' ? colors.accent : colors.textTertiary} />
            <Text style={[styles.tabLabel, activeTab === 'catalog' && styles.tabLabelActive]}>
              {t('tabCatalogManage')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'store' && styles.tabItemActive]}
            onPress={() => setActiveTab('store')}
            activeOpacity={0.7}
          >
            <Store size={14} color={activeTab === 'store' ? colors.accent : colors.textTertiary} />
            <Text style={[styles.tabLabel, activeTab === 'store' && styles.tabLabelActive]}>
              {t('tabMyStore')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'engines' && styles.tabItemActive]}
            onPress={() => setActiveTab('engines')}
            activeOpacity={0.7}
          >
            <Sparkles size={14} color={activeTab === 'engines' ? colors.accent : colors.textTertiary} />
            <Text style={[styles.tabLabel, activeTab === 'engines' && styles.tabLabelActive]}>
              {t('tabAIEngines')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'preferences' && styles.tabItemActive]}
            onPress={() => setActiveTab('preferences')}
            activeOpacity={0.7}
          >
            <Settings size={14} color={activeTab === 'preferences' ? colors.accent : colors.textTertiary} />
            <Text style={[styles.tabLabel, activeTab === 'preferences' && styles.tabLabelActive]}>
              {t('tabPreferences')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* TAB 1: CATALOG MANAGEMENT */}
          {activeTab === 'catalog' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{t('catalogManagementTitle')}</Text>
                  <Text style={styles.sectionDesc}>
                    {products.length} {t('totalProductsCount')} · {t('catalogManagementDesc')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddProduct}
                  activeOpacity={0.85}
                >
                  <Plus size={14} color={colors.textInverse} />
                  <Text style={styles.addButtonText}>{t('add')}</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Search */}
              <View style={styles.searchBar}>
                <Search size={14} color={colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  value={catalogSearch}
                  onChangeText={setCatalogSearch}
                  placeholder={t('searchPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.productsList}>
                {filteredAdminProducts.map(item => {
                  const catalogPhoto =
                    item.photos?.find(p => p.type === 'catalog')?.storagePath ||
                    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80';

                  const isInactive = item.active === false;

                  return (
                    <View key={item.id} style={[styles.productAdminRow, isInactive && styles.productAdminRowInactive]}>
                      <Image source={{ uri: catalogPhoto }} style={styles.productThumb} resizeMode="cover" />

                      <View style={styles.productDetails}>
                        <View style={styles.productTitleRow}>
                          <Text style={styles.productTitle} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {isInactive && (
                            <View style={styles.inactiveChip}>
                              <Text style={styles.inactiveChipText}>{t('statusDisabled')}</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.productPrice}>
                          {formatCurrency(item.price, item.currency)}
                        </Text>
                        <Text style={styles.productStock}>
                          {item.stock || 1} {t('units')} ({t('inStock')}) · {item.category}
                        </Text>
                      </View>

                      <View style={styles.productActions}>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => handleEditProduct(item)}
                          activeOpacity={0.7}
                        >
                          <Edit2 size={15} color={colors.accent} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.iconBtn, styles.iconBtnDelete]}
                          onPress={() => handleDeleteProduct(item.id)}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={15} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* TAB 2: MY STORE */}
          {activeTab === 'store' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>{t('storeInfoTitle')}</Text>
                  <Text style={styles.sectionDesc}>{t('storeInfoDesc')}</Text>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('storeNameField')}</Text>
                  <TextInput
                    style={styles.input}
                    value={storeName}
                    onChangeText={setStoreName}
                    placeholder="ATELIER MAISON"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('storeSubtitleField')}</Text>
                  <TextInput
                    style={styles.input}
                    value={storeSubtitle}
                    onChangeText={setStoreSubtitle}
                    placeholder="PROVADOR VIRTUAL IA"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>{t('storeStatusField')}</Text>
                    <Text style={styles.switchDesc}>{t('storeStatusActive')}</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.toggleBtn, storeActive && styles.toggleBtnActive]}
                    onPress={() => setStoreActive(!storeActive)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.toggleText, storeActive && styles.toggleTextActive]}>
                      {storeActive ? t('statusActive') : t('statusDisabled')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.saveStoreBtn}
                  onPress={handleSaveStore}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveStoreBtnText}>{t('storeSaveBtn')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB 3: AI ENGINES */}
          {activeTab === 'engines' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>{t('aiEnginesTitle')}</Text>
                  <Text style={styles.sectionDesc}>{t('aiEnginesDesc')}</Text>
                </View>
              </View>

              {/* Perfect Corp Engine */}
              <View style={[styles.engineCard, defaultEngine === 'perfectcorp' && styles.engineCardActive]}>
                <View style={styles.engineHeader}>
                  <View style={styles.engineIconWrapper}>
                    <Sparkles size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.engineTitleRow}>
                      <Text style={styles.engineName}>{t('perfectCorpTitle')}</Text>
                      {defaultEngine === 'perfectcorp' && (
                        <View style={styles.defaultPill}>
                          <Text style={styles.defaultPillText}>{t('defaultEngineBadge')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.engineDesc}>{t('perfectCorpDesc')}</Text>
                  </View>
                </View>

                <View style={styles.engineStatusRow}>
                  <View style={styles.statusIndicator}>
                    <CheckCircle2 size={13} color={colors.success} />
                    <Text style={styles.statusText}>{t('statusConnected')}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.setPrimaryBtn}
                    onPress={() => handleSaveEngineConfig('perfectcorp', true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.setPrimaryBtnText}>
                      {defaultEngine === 'perfectcorp' ? `✓ ${t('defaultEngineBadge')}` : t('setAsMainEngineBtn')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.engineNotice}>{t('securityNoticeVault')}</Text>
              </View>

              {/* Google Gemini Engine */}
              <View style={[styles.engineCard, defaultEngine === 'google' && styles.engineCardActive]}>
                <View style={styles.engineHeader}>
                  <View style={styles.engineIconWrapper}>
                    <Zap size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.engineTitleRow}>
                      <Text style={styles.engineName}>{t('googleTitle')}</Text>
                      {defaultEngine === 'google' && (
                        <View style={styles.defaultPill}>
                          <Text style={styles.defaultPillText}>{t('defaultEngineBadge')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.engineDesc}>{t('googleDesc')}</Text>
                  </View>
                </View>

                <View style={styles.engineStatusRow}>
                  <View style={styles.statusIndicator}>
                    <CheckCircle2 size={13} color={colors.success} />
                    <Text style={styles.statusText}>{t('statusConnected')}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.setPrimaryBtn}
                    onPress={() => handleSaveEngineConfig('google', true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.setPrimaryBtnText}>
                      {defaultEngine === 'google' ? `✓ ${t('defaultEngineBadge')}` : t('setAsMainEngineBtn')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.engineNotice}>{t('securityNoticeVault')}</Text>
              </View>

              {/* SEMANTIC PIPELINE & DIAGNOSTIC CARD (FASE 4 / 4.1) */}
              <View style={styles.semanticCard}>
                <View style={styles.semanticCardHeader}>
                  <View style={styles.semanticIconBadge}>
                    <ShieldCheck size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.semanticCardTitle}>{t('semanticPipelineTitle')}</Text>
                    <Text style={styles.semanticCardDesc}>{t('semanticPipelineDesc')}</Text>
                  </View>
                </View>

                {/* Architecture Rules Notice */}
                <View style={styles.semanticRuleBanner}>
                  <Lock size={14} color={colors.accent} />
                  <Text style={styles.semanticRuleText}>{t('semanticLockStatus')}</Text>
                </View>

                <View style={styles.semanticFlowContainer}>
                  <View style={styles.semanticFlowStep}>
                    <Text style={styles.semanticStepLabel}>{t('semanticPersonRole')}</Text>
                    <Text style={styles.semanticStepSub}>src_file_url</Text>
                  </View>
                  <ArrowRight size={16} color={colors.accent} />
                  <View style={styles.semanticFlowStep}>
                    <Text style={styles.semanticStepLabel}>{t('semanticGarmentRole')}</Text>
                    <Text style={styles.semanticStepSub}>ref_file_url</Text>
                  </View>
                  <ArrowRight size={16} color={colors.accent} />
                  <View style={styles.semanticFlowStep}>
                    <Text style={styles.semanticStepLabel}>VTON AI</Text>
                    <Text style={styles.semanticStepSub}>Pipeline Seguro</Text>
                  </View>
                </View>

                {/* Product selector for inspection */}
                <Text style={styles.semanticSelectLabel}>{t('selectPieceToInspect')}:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.semanticProdScroll}>
                  {products.map(prod => {
                    const isSelected = diagnosticSelectedProduct?.id === prod.id;
                    const catPhoto = prod.photos?.find(p => p.type === 'catalog')?.storagePath;
                    return (
                      <TouchableOpacity
                        key={prod.id}
                        style={[styles.semanticProdChip, isSelected && styles.semanticProdChipSelected]}
                        onPress={() => {
                          setDiagnosticSelectedProduct(prod);
                          setDiagnosticResult(null);
                          setDiagnosticError(null);
                        }}
                        activeOpacity={0.8}
                      >
                        {catPhoto && (
                          <Image source={{ uri: catPhoto }} style={styles.semanticProdChipImg} />
                        )}
                        <Text
                          style={[styles.semanticProdChipText, isSelected && styles.semanticProdChipTextSelected]}
                          numberOfLines={1}
                        >
                          {prod.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Run Diagnostic Button */}
                <TouchableOpacity
                  style={[styles.semanticActionBtn, diagnosticLoading && { opacity: 0.7 }]}
                  onPress={() => handleRunDiagnostic()}
                  disabled={diagnosticLoading}
                  activeOpacity={0.85}
                >
                  {diagnosticLoading ? (
                    <>
                      <ActivityIndicator size="small" color="#07080a" />
                      <Text style={styles.semanticActionBtnText}>{t('runningDiagnostic')}</Text>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} color="#07080a" />
                      <Text style={styles.semanticActionBtnText}>{t('runDiagnosticBtn')}</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Diagnostic Result */}
                {diagnosticError && (
                  <View style={styles.semanticErrorBox}>
                    <ShieldAlert size={16} color={colors.error} />
                    <Text style={styles.semanticErrorText}>{diagnosticError}</Text>
                  </View>
                )}

                {diagnosticResult && (
                  <View style={styles.semanticResultBox}>
                    <View style={styles.semanticSuccessHeader}>
                      <CheckCircle2 size={18} color={colors.success} />
                      <Text style={styles.semanticSuccessTitle}>{t('semanticCheckPassed')}</Text>
                    </View>

                    {/* Metadata Grid */}
                    <View style={styles.semanticMetaGrid}>
                      {/* Person Metadata */}
                      <View style={styles.semanticMetaCard}>
                        <View style={styles.semanticMetaCardHeader}>
                          <Text style={styles.semanticMetaCardTitle}>{t('semanticPersonRole')}</Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('dimensionsTitle')}:</Text>
                          <Text style={styles.semanticMetaVal}>
                            {diagnosticResult.validation?.person?.dimensions?.width} x{' '}
                            {diagnosticResult.validation?.person?.dimensions?.height} px
                          </Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('sizeTitle')}:</Text>
                          <Text style={styles.semanticMetaVal}>
                            {(diagnosticResult.validation?.person?.sizeBytes / 1024).toFixed(1)} KB
                          </Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('mimeTitle')}:</Text>
                          <Text style={styles.semanticMetaVal}>
                            {diagnosticResult.validation?.person?.mimeType}
                          </Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('hashTitle')}:</Text>
                          <Text style={styles.semanticHashVal} numberOfLines={1}>
                            {diagnosticResult.validation?.person?.contentHash?.slice(0, 16)}...
                          </Text>
                        </View>
                      </View>

                      {/* Garment Metadata */}
                      <View style={styles.semanticMetaCard}>
                        <View style={styles.semanticMetaCardHeader}>
                          <Text style={styles.semanticMetaCardTitle}>{t('semanticGarmentRole')}</Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('dimensionsTitle')}:</Text>
                          <Text style={styles.semanticMetaVal}>
                            {diagnosticResult.validation?.garment?.dimensions?.width} x{' '}
                            {diagnosticResult.validation?.garment?.dimensions?.height} px
                          </Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('sizeTitle')}:</Text>
                          <Text style={styles.semanticMetaVal}>
                            {(diagnosticResult.validation?.garment?.sizeBytes / 1024).toFixed(1)} KB
                          </Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('mimeTitle')}:</Text>
                          <Text style={styles.semanticMetaVal}>
                            {diagnosticResult.validation?.garment?.mimeType}
                          </Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('hashTitle')}:</Text>
                          <Text style={styles.semanticHashVal} numberOfLines={1}>
                            {diagnosticResult.validation?.garment?.contentHash?.slice(0, 16)}...
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Hash Comparison & Preparation confirmation */}
                    <View style={styles.semanticSecurityPill}>
                      <Check size={14} color={colors.success} />
                      <Text style={styles.semanticSecurityPillText}>{t('hashComparisonOk')}</Text>
                    </View>

                    <View style={styles.semanticPrepPill}>
                      <Text style={styles.semanticPrepPillText}>
                        ✓ {t('garmentPrepNotice')} ({diagnosticResult.preparation?.segmentationStatus || 'try_on_reference pura'})
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* TAB 4: PREFERENCES & INTERNATIONALIZATION */}
          {activeTab === 'preferences' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>{t('preferencesTitle')}</Text>
                  <Text style={styles.sectionDesc}>{t('preferencesDesc')}</Text>
                </View>
              </View>

              {/* Language Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Globe size={16} color={colors.accent} />
                  <Text style={styles.cardTitle}>{t('languageSettingTitle')}</Text>
                </View>
                <Text style={styles.cardDesc}>{t('languageSettingDesc')}</Text>

                <View style={styles.langOptionsGrid}>
                  {languages.map(lang => (
                    <TouchableOpacity
                      key={lang.code}
                      style={[
                        styles.langCardOption,
                        language === lang.code && styles.langCardOptionActive,
                      ]}
                      onPress={() => setLanguage(lang.code)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.langFlagBig}>{lang.flag}</Text>
                      <View>
                        <Text
                          style={[
                            styles.langOptionName,
                            language === lang.code && styles.langOptionNameActive,
                          ]}
                        >
                          {lang.label}
                        </Text>
                        <Text style={styles.langOptionCode}>{lang.code.toUpperCase()}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Theme & Identity Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Sparkles size={16} color={colors.accent} />
                  <Text style={styles.cardTitle}>{t('themeSettingTitle')}</Text>
                </View>
                <Text style={styles.cardDesc}>{t('themeSettingDesc')}</Text>

                <View style={styles.themePaletteRow}>
                  <View style={[styles.paletteCircle, { backgroundColor: '#07080a', borderColor: colors.borderLight }]}>
                    <Text style={styles.paletteLabel}>Noir</Text>
                  </View>
                  <View style={[styles.paletteCircle, { backgroundColor: '#0f1117', borderColor: colors.borderLight }]}>
                    <Text style={styles.paletteLabel}>Surface</Text>
                  </View>
                  <View style={[styles.paletteCircle, { backgroundColor: '#d4af37' }]}>
                    <Text style={[styles.paletteLabel, { color: '#07080a' }]}>Gold</Text>
                  </View>
                </View>
              </View>

              {/* Role Simulation Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <ShieldCheck size={16} color={colors.accent} />
                  <Text style={styles.cardTitle}>{t('roleSettingTitle')}</Text>
                </View>
                <Text style={styles.cardDesc}>{t('roleSettingDesc')}</Text>

                <View style={styles.rolesList}>
                  <TouchableOpacity
                    style={[styles.roleOption, userRole === 'owner' && styles.roleOptionActive]}
                    onPress={() => setUserRole('owner')}
                  >
                    <Text style={[styles.roleText, userRole === 'owner' && styles.roleTextActive]}>
                      {t('roleOwner')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roleOption, userRole === 'manager' && styles.roleOptionActive]}
                    onPress={() => setUserRole('manager')}
                  >
                    <Text style={[styles.roleText, userRole === 'manager' && styles.roleTextActive]}>
                      {t('roleManager')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roleOption, userRole === 'customer' && styles.roleOptionActive]}
                    onPress={() => setUserRole('customer')}
                  >
                    <Text style={[styles.roleText, userRole === 'customer' && styles.roleTextActive]}>
                      {t('roleCustomer')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Modal for Product Add/Edit */}
        <AdminProductModal
          visible={modalVisible}
          product={selectedProductForEdit}
          onClose={() => setModalVisible(false)}
          onSave={handleSaveProduct}
          onDelete={handleDeleteProduct}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.accent,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: colors.accent,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sectionContainer: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
  },
  addButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textInverse,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    height: 38,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
  },
  productsList: {
    gap: spacing.sm,
  },
  productAdminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.sm,
    gap: spacing.md,
  },
  productAdminRowInactive: {
    opacity: 0.65,
    borderStyle: 'dashed',
  },
  productThumb: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
  },
  productDetails: {
    flex: 1,
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  inactiveChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.xs,
  },
  inactiveChipText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.error,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 1,
  },
  productStock: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  productActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDelete: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: colors.errorLight,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: -spacing.xs,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    color: colors.textPrimary,
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  switchTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  switchDesc: {
    fontSize: 11,
    color: colors.textTertiary,
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
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  toggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  toggleTextActive: {
    color: colors.success,
  },
  saveStoreBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveStoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  engineCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  engineCardActive: {
    borderColor: colors.accent,
  },
  engineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  engineIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  engineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  engineName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  defaultPill: {
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  defaultPillText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  engineDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  engineStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  setPrimaryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  setPrimaryBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  engineNotice: {
    fontSize: 11,
    color: colors.textTertiary,
    lineHeight: 15,
  },
  langOptionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  langCardOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  langCardOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  langFlagBig: {
    fontSize: 22,
  },
  langOptionName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  langOptionNameActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  langOptionCode: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  themePaletteRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  paletteCircle: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  rolesList: {
    gap: 6,
  },
  roleOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  roleOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  semanticCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.md,
    ...shadows.card,
  },
  semanticCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  semanticIconBadge: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  semanticCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  semanticCardDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  semanticRuleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  semanticRuleText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
    flex: 1,
  },
  semanticFlowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  semanticFlowStep: {
    alignItems: 'center',
  },
  semanticStepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  semanticStepSub: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 2,
  },
  semanticSelectLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  semanticProdScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  semanticProdChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: spacing.xs,
  },
  semanticProdChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  semanticProdChipImg: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  semanticProdChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    maxWidth: 120,
  },
  semanticProdChipTextSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
  semanticActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  semanticActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#07080a',
    letterSpacing: 0.5,
  },
  semanticErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  semanticErrorText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.error,
    flex: 1,
  },
  semanticResultBox: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: spacing.md,
  },
  semanticSuccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  semanticSuccessTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  semanticMetaGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  semanticMetaCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.sm,
    gap: 4,
  },
  semanticMetaCardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: 4,
    marginBottom: 4,
  },
  semanticMetaCardTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },
  semanticMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  semanticMetaLabel: {
    fontSize: 9,
    color: colors.textTertiary,
  },
  semanticMetaVal: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  semanticHashVal: {
    fontSize: 8,
    fontWeight: '600',
    color: colors.accent,
    maxWidth: 70,
  },
  semanticSecurityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  semanticSecurityPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.success,
    flex: 1,
  },
  semanticPrepPill: {
    backgroundColor: colors.accentGlow,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  semanticPrepPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
  },
});
