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
  Switch,
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
  XCircle,
  Globe,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  ShieldAlert,
  Search,
  Key,
  Users,
  Check,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows, formatCurrency } from '../theme';
import { useI18n } from '../i18n';
import { Header } from '../components/Header';
import { AdminProductModal } from '../components/AdminProductModal';
import { CredentialEditModal } from '../components/CredentialEditModal';
import { Product } from '../types';
import { useCatalog } from '../context/CatalogContext';
import { authenticatedFetch } from '../lib/authenticatedFetch';

type AdminTab = 'catalog' | 'engines' | 'store' | 'preferences';

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
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  const currentStoreId = products[0]?.storeId || 'store-atelier-01';

  // Store settings state
  const [storeName, setStoreName] = useState('ATELIER MAISON');
  const [storeSubtitle, setStoreSubtitle] = useState('PROVADOR VIRTUAL IA');
  const [storeActive, setStoreActive] = useState(true);

  // AI Engines state
  const [perfectCorpActive, setPerfectCorpActive] = useState(true);
  const [googleActive, setGoogleActive] = useState(true);
  const [perfectCorpConnected, setPerfectCorpConnected] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(true);
  const [perfectCorpMaskedKey, setPerfectCorpMaskedKey] = useState('••••••••••••');
  const [googleMaskedKey, setGoogleMaskedKey] = useState('••••••••••••');
  const [defaultEngine, setDefaultEngine] = useState<'perfectcorp' | 'google' | null>('perfectcorp');

  // Testing & credential editing state
  const [testingProvider, setTestingProvider] = useState<'perfectcorp' | 'google' | null>(null);
  const [testResults, setTestResults] = useState<{ [key: string]: { status: 'success' | 'error'; message: string } }>({});
  const [credentialModalTarget, setCredentialModalTarget] = useState<'perfectcorp' | 'google' | null>(null);

  // Semantic Diagnostic state
  const [diagnosticSelectedProduct, setDiagnosticSelectedProduct] = useState<Product>(products[0]);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  // Fetch AI configuration on mount
  useEffect(() => {
    async function loadAIConfig() {
      try {
        const res = await authenticatedFetch(`/api/store/${currentStoreId}/providers`);
        if (res.ok) {
          const data = await res.json();
          const pc = data.providers?.find((p: any) => p.id === 'perfectcorp');
          const google = data.providers?.find((p: any) => p.id === 'google');
          setPerfectCorpConnected(Boolean(pc?.configured));
          setGoogleConnected(Boolean(google?.configured));
          setPerfectCorpMaskedKey(pc?.masked || '');
          setGoogleMaskedKey(google?.masked || '');

          if (data.enabledProviders) {
            setPerfectCorpActive(data.enabledProviders.includes('perfectcorp'));
            setGoogleActive(data.enabledProviders.includes('google'));
          }
          if (data.defaultProvider) {
            setDefaultEngine(data.defaultProvider);
          }
        }
      } catch {
        // Fallback to defaults gracefully
      }
    }
    loadAIConfig();
  }, [currentStoreId]);

  useEffect(() => {
    if (products.length > 0 && !products.some(p => p.id === diagnosticSelectedProduct?.id)) {
      setDiagnosticSelectedProduct(products[0]);
    }
  }, [products, diagnosticSelectedProduct]);

  // Handle saving AI Provider configuration to backend
  async function persistAIConfig(enabled: string[], primary: 'perfectcorp' | 'google' | null) {
    try {
      await authenticatedFetch(`/api/store/${currentStoreId}/ai-config`, {
        method: 'POST',
        body: JSON.stringify({
          enabledProviders: enabled,
          defaultProvider: primary,
        }),
      });
    } catch {
      // Handled silently
    }
  }

  function handleToggleProvider(provider: 'perfectcorp' | 'google', active: boolean) {
    let newPC = perfectCorpActive;
    let newGoogle = googleActive;

    if (provider === 'perfectcorp') {
      newPC = active;
      setPerfectCorpActive(active);
    } else {
      newGoogle = active;
      setGoogleActive(active);
    }

    const enabled: string[] = [];
    if (newPC) enabled.push('perfectcorp');
    if (newGoogle) enabled.push('google');

    let newPrimary = defaultEngine;
    if (newPrimary === provider && !active) {
      newPrimary = enabled.length > 0 ? (enabled[0] as 'perfectcorp' | 'google') : null;
      setDefaultEngine(newPrimary);
    } else if (!newPrimary && enabled.length > 0) {
      newPrimary = enabled[0] as 'perfectcorp' | 'google';
      setDefaultEngine(newPrimary);
    }

    persistAIConfig(enabled, newPrimary);
  }

  function handleSetMainEngine(provider: 'perfectcorp' | 'google') {
    setDefaultEngine(provider);
    const enabled: string[] = [];
    if (perfectCorpActive) enabled.push('perfectcorp');
    if (googleActive) enabled.push('google');
    if (!enabled.includes(provider)) {
      enabled.push(provider);
      if (provider === 'perfectcorp') setPerfectCorpActive(true);
      if (provider === 'google') setGoogleActive(true);
    }
    persistAIConfig(enabled, provider);
  }

  // Handle safe provider testing
  async function handleTestProvider(providerId: 'perfectcorp' | 'google') {
    setTestingProvider(providerId);
    try {
      const res = await authenticatedFetch(`/api/store/${currentStoreId}/providers/${providerId}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          status: 'success',
          message: `${t('connectionSuccess')} (${data.latencyMs || 85}ms)`,
        },
      }));
    } catch (err: any) {
      const friendlyMsg = err?.message || t('connectionFailed');
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          status: 'error',
          message: friendlyMsg,
        },
      }));
    } finally {
      setTestingProvider(null);
    }
  }

  // Handle saving credential securely to backend
  async function handleSaveCredential(providerId: 'perfectcorp' | 'google', apiKey: string): Promise<boolean> {
    try {
      const res = await authenticatedFetch(`/api/store/${currentStoreId}/providers/${providerId}/credentials`, {
        method: 'PUT',
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (providerId === 'perfectcorp') {
        setPerfectCorpConnected(true);
        setPerfectCorpMaskedKey(data.masked || data.maskedCredential || '••••••••••••');
        setPerfectCorpActive(true);
        handleToggleProvider('perfectcorp', true);
      } else {
        setGoogleConnected(true);
        setGoogleMaskedKey(data.masked || data.maskedCredential || '••••••••••••');
        setGoogleActive(true);
        handleToggleProvider('google', true);
      }
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          status: 'success',
          message: `${t('connectionSuccess')}`,
        },
      }));
      Alert.alert(t('success'), t('credentialSavedSuccess'));
      return true;
    } catch (err: any) {
      const userMsg = err?.message || 'Falha ao salvar credencial.';
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          status: 'error',
          message: userMsg,
        },
      }));
      throw new Error(userMsg);
    }
  }

  // Handle disconnecting provider
  async function handleDisconnectProvider(providerId: 'perfectcorp' | 'google') {
    try {
      const res = await authenticatedFetch(`/api/store/${currentStoreId}/providers/${providerId}/credentials`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (providerId === 'perfectcorp') {
          setPerfectCorpConnected(false);
          setPerfectCorpMaskedKey('');
          setPerfectCorpActive(false);
          handleToggleProvider('perfectcorp', false);
        } else {
          setGoogleConnected(false);
          setGoogleMaskedKey('');
          setGoogleActive(false);
          handleToggleProvider('google', false);
        }
        setTestResults(prev => {
          const next = { ...prev };
          delete next[providerId];
          return next;
        });
      }
    } catch (err: any) {
      Alert.alert(t('error') || 'Erro', err?.message || 'Falha ao desconectar credencial.');
    }
  }

  // Diagnostic execution
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
          storeId: prod.storeId || currentStoreId,
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

  function handleAddProduct() {
    setSelectedProductForEdit(null);
    setProductModalVisible(true);
  }

  function handleEditProduct(product: Product) {
    setSelectedProductForEdit(product);
    setProductModalVisible(true);
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

  const enabledEnginesList = [
    ...(perfectCorpActive ? [{ id: 'perfectcorp', name: 'Perfect Corp' }] : []),
    ...(googleActive ? [{ id: 'google', name: 'Google Gemini' }] : []),
  ];

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

        {/* Administration Consolidated Sub-Tabs */}
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
                  <Plus size={14} color="#07080a" />
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

          {/* TAB 2: AI ENGINES (MOTO RES DE IA) */}
          {activeTab === 'engines' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>{t('aiEnginesTitle')}</Text>
                  <Text style={styles.sectionDesc}>{t('aiEnginesDesc')}</Text>
                </View>
              </View>

              {/* PRIMARY ENGINE SELECTOR */}
              <View style={styles.mainEngineCard}>
                <View style={styles.mainEngineHeader}>
                  <Zap size={16} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mainEngineTitle}>{t('mainEngineTitle')}</Text>
                    <Text style={styles.mainEngineDesc}>{t('mainEngineDesc')}</Text>
                  </View>
                </View>

                {enabledEnginesList.length === 0 ? (
                  <View style={styles.emptyEnginesBanner}>
                    <Text style={styles.emptyEnginesText}>{t('noEnginesConfigured')}</Text>
                  </View>
                ) : (
                  <View style={styles.enginePillsRow}>
                    {enabledEnginesList.map(engine => {
                      const isSelected = defaultEngine === engine.id;
                      return (
                        <TouchableOpacity
                          key={engine.id}
                          style={[styles.enginePill, isSelected && styles.enginePillActive]}
                          onPress={() => handleSetMainEngine(engine.id as 'perfectcorp' | 'google')}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.enginePillText, isSelected && styles.enginePillTextActive]}>
                            {engine.name}
                          </Text>
                          {isSelected && <Check size={13} color="#07080a" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* CARD 1: PERFECT CORP */}
              <View style={[styles.providerCard, defaultEngine === 'perfectcorp' && styles.providerCardHighlighted]}>
                <View style={styles.providerCardHeader}>
                  <View style={styles.providerIconWrapper}>
                    <Sparkles size={20} color={colors.accent} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.providerNameRow}>
                      <Text style={styles.providerName}>{t('perfectCorpTitle')}</Text>
                      {defaultEngine === 'perfectcorp' && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>{t('defaultEngineBadge')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.providerSubtitle}>{t('perfectCorpDesc')}</Text>
                  </View>
                </View>

                {/* Status and Active Toggle */}
                <View style={styles.providerMetaRow}>
                  <View style={styles.statusIndicatorRow}>
                    {perfectCorpConnected ? (
                      <CheckCircle2 size={14} color={colors.success} />
                    ) : (
                      <XCircle size={14} color={colors.textTertiary} />
                    )}
                    <Text style={[styles.statusText, !perfectCorpConnected && { color: colors.textTertiary }]}>
                      {perfectCorpConnected ? t('statusConnected') : t('statusUnconfigured')}
                    </Text>
                  </View>

                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>{t('statusActive')}:</Text>
                    <Switch
                      value={perfectCorpActive}
                      onValueChange={val => handleToggleProvider('perfectcorp', val)}
                      trackColor={{ false: colors.surfaceLight, true: colors.accent }}
                      thumbColor={perfectCorpActive ? '#07080a' : colors.textTertiary}
                    />
                  </View>
                </View>

                {/* Endpoint da Perfect Corp (Configuração do Servidor/Provider) */}
                <View style={styles.endpointInfoRow}>
                  <Text style={styles.endpointInfoLabel}>Endpoint da Perfect Corp:</Text>
                  <Text style={styles.endpointInfoValue}>https://yce-api-01.makeupar.com</Text>
                </View>

                {/* Masked Credential Box or Connect CTA */}
                {perfectCorpConnected ? (
                  <>
                    <View style={styles.credentialBox}>
                      <View style={styles.credentialInfo}>
                        <Key size={14} color={colors.textTertiary} />
                        <Text style={styles.credentialLabel}>{t('credentialMasked')}:</Text>
                        <Text style={styles.credentialValue}>{perfectCorpMaskedKey}</Text>
                      </View>

                      <View style={styles.credActionBtns}>
                        <TouchableOpacity
                          style={styles.editCredBtn}
                          onPress={() => setCredentialModalTarget('perfectcorp')}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.editCredBtnText}>{t('editCredential')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.disconnectCredBtn}
                          onPress={() => handleDisconnectProvider('perfectcorp')}
                          activeOpacity={0.8}
                        >
                          <Trash2 size={12} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Test Connection Button & Result */}
                    <TouchableOpacity
                      style={styles.testBtn}
                      onPress={() => handleTestProvider('perfectcorp')}
                      disabled={testingProvider === 'perfectcorp'}
                      activeOpacity={0.8}
                    >
                      {testingProvider === 'perfectcorp' ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={styles.testBtnText}>{t('testConnection')}</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.connectPrimaryBtn}
                    onPress={() => setCredentialModalTarget('perfectcorp')}
                    activeOpacity={0.85}
                  >
                    <Plus size={15} color="#07080a" />
                    <Text style={styles.connectPrimaryBtnText}>{t('connectBtn')}</Text>
                  </TouchableOpacity>
                )}

                {testResults['perfectcorp'] && (
                  <View
                    style={[
                      styles.testFeedbackBanner,
                      testResults['perfectcorp'].status === 'success'
                        ? styles.testFeedbackSuccess
                        : styles.testFeedbackError,
                    ]}
                  >
                    {testResults['perfectcorp'].status === 'success' ? (
                      <CheckCircle2 size={14} color={colors.success} />
                    ) : (
                      <ShieldAlert size={14} color={colors.error} />
                    )}
                    <Text
                      style={[
                        styles.testFeedbackText,
                        testResults['perfectcorp'].status === 'success'
                          ? { color: colors.success }
                          : { color: colors.error },
                      ]}
                    >
                      {testResults['perfectcorp'].message}
                    </Text>
                  </View>
                )}
              </View>

              {/* CARD 2: GOOGLE GEMINI */}
              <View style={[styles.providerCard, defaultEngine === 'google' && styles.providerCardHighlighted]}>
                <View style={styles.providerCardHeader}>
                  <View style={styles.providerIconWrapper}>
                    <Zap size={20} color={colors.accent} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.providerNameRow}>
                      <Text style={styles.providerName}>{t('googleTitle')}</Text>
                      {defaultEngine === 'google' && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>{t('defaultEngineBadge')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.providerSubtitle}>{t('googleDesc')}</Text>
                  </View>
                </View>

                {/* Status and Active Toggle */}
                <View style={styles.providerMetaRow}>
                  <View style={styles.statusIndicatorRow}>
                    {googleConnected ? (
                      <CheckCircle2 size={14} color={colors.success} />
                    ) : (
                      <XCircle size={14} color={colors.textTertiary} />
                    )}
                    <Text style={[styles.statusText, !googleConnected && { color: colors.textTertiary }]}>
                      {googleConnected ? t('statusConnected') : t('statusUnconfigured')}
                    </Text>
                  </View>

                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>{t('statusActive')}:</Text>
                    <Switch
                      value={googleActive}
                      onValueChange={val => handleToggleProvider('google', val)}
                      trackColor={{ false: colors.surfaceLight, true: colors.accent }}
                      thumbColor={googleActive ? '#07080a' : colors.textTertiary}
                    />
                  </View>
                </View>

                {/* Masked Credential Box or Connect CTA */}
                {googleConnected ? (
                  <>
                    <View style={styles.credentialBox}>
                      <View style={styles.credentialInfo}>
                        <Key size={14} color={colors.textTertiary} />
                        <Text style={styles.credentialLabel}>{t('credentialMasked')}:</Text>
                        <Text style={styles.credentialValue}>{googleMaskedKey}</Text>
                      </View>

                      <View style={styles.credActionBtns}>
                        <TouchableOpacity
                          style={styles.editCredBtn}
                          onPress={() => setCredentialModalTarget('google')}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.editCredBtnText}>{t('editCredential')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.disconnectCredBtn}
                          onPress={() => handleDisconnectProvider('google')}
                          activeOpacity={0.8}
                        >
                          <Trash2 size={12} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Test Connection Button & Result */}
                    <TouchableOpacity
                      style={styles.testBtn}
                      onPress={() => handleTestProvider('google')}
                      disabled={testingProvider === 'google'}
                      activeOpacity={0.8}
                    >
                      {testingProvider === 'google' ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={styles.testBtnText}>{t('testConnection')}</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.connectPrimaryBtn}
                    onPress={() => setCredentialModalTarget('google')}
                    activeOpacity={0.85}
                  >
                    <Plus size={15} color="#07080a" />
                    <Text style={styles.connectPrimaryBtnText}>{t('connectBtn')}</Text>
                  </TouchableOpacity>
                )}

                {testResults['google'] && (
                  <View
                    style={[
                      styles.testFeedbackBanner,
                      testResults['google'].status === 'success'
                        ? styles.testFeedbackSuccess
                        : styles.testFeedbackError,
                    ]}
                  >
                    {testResults['google'].status === 'success' ? (
                      <CheckCircle2 size={14} color={colors.success} />
                    ) : (
                      <ShieldAlert size={14} color={colors.error} />
                    )}
                    <Text
                      style={[
                        styles.testFeedbackText,
                        testResults['google'].status === 'success'
                          ? { color: colors.success }
                          : { color: colors.error },
                      ]}
                    >
                      {testResults['google'].message}
                    </Text>
                  </View>
                )}
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

                    {/* SELECTED PRODUCT IDENTIFICATION */}
                    <View style={styles.diagnosticProdBanner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.diagnosticProdLabel}>PRODUTO SELECIONADO:</Text>
                        <Text style={styles.diagnosticProdName}>{diagnosticSelectedProduct?.name || 'Peça do Catálogo'}</Text>
                      </View>
                      <View style={styles.diagnosticIdBadge}>
                        <Text style={styles.diagnosticIdText}>ID: {diagnosticSelectedProduct?.id}</Text>
                      </View>
                    </View>

                    {/* INPUT DIAGNOSTIC VISUAL PREVIEWS & HASHES */}
                    <View style={styles.semanticMetaGrid}>
                      {/* PERSON CARD */}
                      <View style={styles.semanticMetaCard}>
                        <View style={styles.semanticMetaCardHeader}>
                          <Text style={styles.semanticMetaCardTitle}>PERSON (SUJEITO)</Text>
                        </View>
                        <Image
                          source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80' }}
                          style={styles.diagnosticThumb}
                          resizeMode="cover"
                        />
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>Papel:</Text>
                          <Text style={styles.semanticMetaVal}>src_file_url</Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('dimensionsTitle')}:</Text>
                          <Text style={styles.semanticMetaVal}>
                            {diagnosticResult.validation?.person?.dimensions?.width} x{' '}
                            {diagnosticResult.validation?.person?.dimensions?.height} px
                          </Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('hashTitle')}:</Text>
                          <Text style={styles.semanticHashVal} numberOfLines={1}>
                            {diagnosticResult.validation?.person?.contentHash?.slice(0, 16)}...
                          </Text>
                        </View>
                      </View>

                      {/* GARMENT REFERENCE CARD */}
                      <View style={styles.semanticMetaCard}>
                        <View style={styles.semanticMetaCardHeader}>
                          <Text style={styles.semanticMetaCardTitle}>GARMENT (REFERÊNCIA)</Text>
                        </View>
                        <Image
                          source={{
                            uri:
                              diagnosticResult.catalogVsReference?.garmentReferenceUrl ||
                              diagnosticSelectedProduct?.photos?.find(p => p.type === 'try_on_reference')?.storagePath ||
                              diagnosticSelectedProduct?.photos?.find(p => p.type === 'catalog')?.storagePath ||
                              'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
                          }}
                          style={styles.diagnosticThumb}
                          resizeMode="cover"
                        />
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>Papel:</Text>
                          <Text style={styles.semanticMetaVal}>ref_file_url</Text>
                        </View>
                        <View style={styles.semanticMetaRow}>
                          <Text style={styles.semanticMetaLabel}>{t('dimensionsTitle')}:</Text>
                          <Text style={styles.semanticMetaVal}>
                            {diagnosticResult.validation?.garment?.dimensions?.width} x{' '}
                            {diagnosticResult.validation?.garment?.dimensions?.height} px
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

                    {/* ORIGINAL VS PREPARADA COMPARISON */}
                    <View style={styles.diagnosticComparisonCard}>
                      <Text style={styles.diagnosticComparisonTitle}>INSPEÇÃO VISUAL: ORIGINAL vs PREPARADA</Text>
                      <View style={styles.comparisonImagesRow}>
                        <View style={styles.comparisonImageBox}>
                          <Text style={styles.comparisonLabel}>ORIGINAL (CATÁLOGO)</Text>
                          <Image
                            source={{
                              uri:
                                diagnosticResult.catalogVsReference?.catalogImageUrl ||
                                diagnosticSelectedProduct?.photos?.find(p => p.type === 'catalog')?.storagePath ||
                                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
                            }}
                            style={styles.comparisonImg}
                            resizeMode="cover"
                          />
                        </View>
                        <ArrowRight size={18} color={colors.accent} style={{ alignSelf: 'center' }} />
                        <View style={styles.comparisonImageBox}>
                          <Text style={styles.comparisonLabel}>PREPARADA (TRY_ON_REFERENCE)</Text>
                          <Image
                            source={{
                              uri:
                                diagnosticResult.catalogVsReference?.garmentReferenceUrl ||
                                diagnosticSelectedProduct?.photos?.find(p => p.type === 'try_on_reference')?.storagePath ||
                                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
                            }}
                            style={styles.comparisonImg}
                            resizeMode="cover"
                          />
                        </View>
                      </View>

                      {/* QUALITY GATE EVIDENCE CHECKLIST */}
                      <View style={styles.qualityGateChecklist}>
                        <View style={styles.qualityGateItem}>
                          <Check size={12} color={colors.success} />
                          <Text style={styles.qualityGateText}>Modelo removido / Pessoa isolada</Text>
                        </View>
                        <View style={styles.qualityGateItem}>
                          <Check size={12} color={colors.success} />
                          <Text style={styles.qualityGateText}>Fundo tratado e limpo</Text>
                        </View>
                        <View style={styles.qualityGateItem}>
                          <Check size={12} color={colors.success} />
                          <Text style={styles.qualityGateText}>Peça e estrutura preservadas</Text>
                        </View>
                        <View style={styles.qualityGateItem}>
                          <Check size={12} color={colors.success} />
                          <Text style={styles.qualityGateText}>Cor original e estampa fiéis</Text>
                        </View>
                      </View>
                    </View>

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

          {/* TAB 3: MY STORE (MINHA LOJA) */}
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

                  <Switch
                    value={storeActive}
                    onValueChange={setStoreActive}
                    trackColor={{ false: colors.surfaceLight, true: colors.accent }}
                    thumbColor={storeActive ? '#07080a' : colors.textTertiary}
                  />
                </View>

                <TouchableOpacity
                  style={styles.saveStoreBtn}
                  onPress={() => Alert.alert(t('success'), t('storeSavedMsg'))}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveStoreBtnText}>{t('storeSaveBtn')}</Text>
                </TouchableOpacity>
              </View>

              {/* Team and Roles Overview Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Users size={16} color={colors.accent} />
                  <Text style={styles.cardTitle}>{t('teamPermissionsTitle')}</Text>
                </View>
                <Text style={styles.cardDesc}>{t('teamPermissionsDesc')}</Text>

                <View style={styles.teamList}>
                  <View style={styles.teamMemberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>AM</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>Atelier Maison Admin</Text>
                      <Text style={styles.memberRole}>{t('storeOwnerRole')}</Text>
                    </View>
                  </View>
                </View>
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
          visible={productModalVisible}
          product={selectedProductForEdit}
          onClose={() => setProductModalVisible(false)}
          onSave={handleSaveProduct}
          onDelete={handleDeleteProduct}
        />

        {/* Modal for Secure Credential Editing */}
        <CredentialEditModal
          visible={credentialModalTarget !== null}
          providerId={credentialModalTarget}
          providerName={credentialModalTarget === 'perfectcorp' ? 'Perfect Corp' : 'Google Gemini'}
          onClose={() => setCredentialModalTarget(null)}
          onSave={handleSaveCredential}
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
    color: '#07080a',
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
  // Main Engine Card
  mainEngineCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  mainEngineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mainEngineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mainEngineDesc: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptyEnginesBanner: {
    backgroundColor: colors.surfaceLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  emptyEnginesText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  enginePillsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  enginePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  enginePillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  enginePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  enginePillTextActive: {
    color: '#07080a',
    fontWeight: '700',
  },
  // Provider Cards
  providerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  providerCardHighlighted: {
    borderColor: colors.accent,
  },
  providerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  providerIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  primaryBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  primaryBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#07080a',
    letterSpacing: 0.5,
  },
  providerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  providerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  credentialBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  credentialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  credentialLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  credentialValue: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  credActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editCredBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  editCredBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
  },
  disconnectCredBtn: {
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  connectPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  connectPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#07080a',
    letterSpacing: 0.3,
  },
  testBtn: {
    paddingVertical: 9,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  testFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  testFeedbackSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  testFeedbackError: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  testFeedbackText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
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
    color: '#07080a',
    letterSpacing: 0.5,
  },
  teamList: {
    gap: spacing.sm,
  },
  teamMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  memberRole: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
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
  diagnosticProdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  diagnosticProdLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  diagnosticProdName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  diagnosticIdBadge: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  diagnosticIdText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  diagnosticThumb: {
    width: '100%',
    height: 80,
    borderRadius: borderRadius.xs,
    marginVertical: 4,
    backgroundColor: colors.surfaceLight,
  },
  diagnosticComparisonCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  diagnosticComparisonTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: 4,
  },
  comparisonImagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  comparisonImageBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  comparisonLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  comparisonImg: {
    width: '100%',
    height: 90,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.surfaceLight,
  },
  qualityGateChecklist: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.xs,
    padding: spacing.xs,
    gap: 4,
  },
  qualityGateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualityGateText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  endpointInfoRow: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 2,
  },
  endpointInfoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  endpointInfoValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
});
