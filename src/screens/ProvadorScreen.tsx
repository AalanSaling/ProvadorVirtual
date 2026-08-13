// src/screens/ProvadorScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { PhotoUpload } from '../components/PhotoUpload';
import { CatalogCard } from '../components/CatalogCard';
import { LgpdConsentModal } from '../components/LgpdConsentModal';
import { TryOnResultModal } from '../components/TryOnResultModal';
import {
  ClothingItem,
  GarmentCategory,
  ProviderType,
} from '../types';
import {
  getSavedUserPhoto,
  saveUserPhoto,
  removeSavedUserPhoto,
  getLgpdConsent,
  saveLgpdConsent,
} from '../lib/storage';
import { mapGarmentCategory, requestVirtualTryOn, TryOnApiResponse } from '../services/vtonService';
import { Sparkles, ArrowRight, Wand2 } from 'lucide-react-native';

interface ProvadorScreenProps {
  catalog: ClothingItem[];
  isDark: boolean;
  onNavigateToCatalog: () => void;
}

export const ProvadorScreen: React.FC<ProvadorScreenProps> = ({
  catalog,
  isDark,
  onNavigateToCatalog,
}) => {
  // State Model
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ClothingItem | null>(catalog[0] || null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('both');
  const [garmentCategory, setGarmentCategory] = useState<GarmentCategory>('upper_body');
  
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [tryOnApiResponse, setTryOnApiResponse] = useState<TryOnApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showLgpdModal, setShowLgpdModal] = useState<boolean>(false);
  const [hasLgpdConsent, setHasLgpdConsent] = useState<boolean>(false);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const savedPhoto = await getSavedUserPhoto();
      if (savedPhoto) setPersonImage(savedPhoto);

      const consent = await getLgpdConsent();
      setHasLgpdConsent(consent);
    })();
  }, []);

  const handleUploadUserPhoto = async (uri: string) => {
    setPersonImage(uri);
    await saveUserPhoto(uri);
  };

  const handleRemoveUserPhoto = async () => {
    await removeSavedUserPhoto();
    setPersonImage(null);
  };

  const handleSelectProduct = (item: ClothingItem) => {
    setSelectedProduct(item);
    setGarmentCategory(mapGarmentCategory(item.category));
  };

  const executeTryOn = async () => {
    if (!personImage) {
      alert('Por favor, envie ou tire uma foto de corpo primeiro.');
      return;
    }
    if (!selectedProduct) {
      alert('Por favor, escolha uma peça do catálogo.');
      return;
    }

    setError(null);
    setTryOnApiResponse(null);
    setIsGenerating(true);

    try {
      const apiResponse = await requestVirtualTryOn({
        personImage,
        garmentImage: selectedProduct.image,
        garmentCategory,
        requestedProvider: selectedProvider,
        onStatusChange: (msg) => setStatusMessage(msg),
      });

      setTryOnApiResponse(apiResponse);
      setShowResultModal(true);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao conectar com os servidores de IA.');
      setShowResultModal(true);
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const handleGenerateClick = () => {
    if (!hasLgpdConsent) {
      setShowLgpdModal(true);
      return;
    }
    executeTryOn();
  };

  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.headerCard, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.headerIcon}>
          <Sparkles color="#ffffff" size={20} />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={[styles.headerTitle, { color: textColor }]}>Provador Virtual IA Real</Text>
          <Text style={[styles.headerSub, { color: subTextColor }]}>
            Geração fotorealista por Inteligência Artificial no servidor
          </Text>
        </View>
      </View>

      {/* Step 1: User Photo Upload */}
      <View style={[styles.stepCard, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.stepHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>1</Text>
          </View>
          <Text style={[styles.stepTitle, { color: textColor }]}>Foto do Corpo (Câmera / Galeria)</Text>
        </View>

        <PhotoUpload
          photoUri={personImage}
          onUpload={handleUploadUserPhoto}
          onRemove={handleRemoveUserPhoto}
          label="Sua Foto de Corpo"
          hint="Selecione da galeria ou tire uma foto agora"
          isDark={isDark}
        />
      </View>

      {/* Step 2: Choose Clothing Item from Catalog */}
      <View style={[styles.stepCard, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.stepHeaderBetween}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <Text style={[styles.stepTitle, { color: textColor }]}>Escolha a Peça de Roupa</Text>
          </View>
          <TouchableOpacity onPress={onNavigateToCatalog} style={styles.seeAllBtn}>
            <Text style={styles.seeAllText}>Ver Tudo</Text>
            <ArrowRight color="#3b82f6" size={14} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catalogHorizontal}>
          {catalog.slice(0, 8).map((item) => (
            <React.Fragment key={item.id}>
              <View style={styles.cardItemWrapper}>
                <CatalogCard
                  item={item}
                  selected={selectedProduct?.id === item.id}
                  onSelect={() => handleSelectProduct(item)}
                  isDark={isDark}
                />
              </View>
            </React.Fragment>
          ))}
        </ScrollView>
      </View>

      {/* Step 3: Provider Selection & Garment Category */}
      <View style={[styles.stepCard, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.stepHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>3</Text>
          </View>
          <Text style={[styles.stepTitle, { color: textColor }]}>Configuração do Motor de IA</Text>
        </View>

        {/* Provider selector */}
        <Text style={[styles.fieldLabel, { color: textColor }]}>Modo de Operação do Provedor</Text>
        <View style={styles.optionRow}>
          {[
            { id: 'perfectcorp' as ProviderType, label: 'Perfect Corp' },
            { id: 'google' as ProviderType, label: 'Google Gemini' },
            { id: 'both' as ProviderType, label: 'Ambos (Comparativo)' },
          ].map((prov) => (
            <React.Fragment key={prov.id}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  onPress={() => setSelectedProvider(prov.id)}
                  style={[
                    styles.optionBtn,
                    {
                      backgroundColor: selectedProvider === prov.id ? '#3b82f6' : isDark ? '#0f172a' : '#f1f5f9',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionBtnText,
                      { color: selectedProvider === prov.id ? '#ffffff' : subTextColor },
                    ]}
                  >
                    {prov.label}
                  </Text>
                </TouchableOpacity>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Garment Category */}
        <Text style={[styles.fieldLabel, { color: textColor, marginTop: 12 }]}>Tipo de Peça</Text>
        <View style={styles.optionRow}>
          {[
            { id: 'upper_body' as GarmentCategory, label: 'Superior' },
            { id: 'lower_body' as GarmentCategory, label: 'Inferior' },
            { id: 'full_body' as GarmentCategory, label: 'Corpo Inteiro' },
          ].map((cat) => (
            <React.Fragment key={cat.id}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  onPress={() => setGarmentCategory(cat.id)}
                  style={[
                    styles.optionBtn,
                    {
                      backgroundColor: garmentCategory === cat.id ? '#3b82f6' : isDark ? '#0f172a' : '#f1f5f9',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionBtnText,
                      { color: garmentCategory === cat.id ? '#ffffff' : subTextColor },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleGenerateClick}
          disabled={isGenerating}
          style={[styles.generateBtn, { backgroundColor: isGenerating ? '#64748b' : '#3b82f6' }]}
        >
          {isGenerating ? (
            <View style={styles.loadingProgressRow}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.generateBtnText}>{statusMessage || 'Processando IA...'}</Text>
            </View>
          ) : (
            <>
              <Wand2 color="#ffffff" size={18} />
              <Text style={styles.generateBtnText}>GERAR PROVADOR VIRTUAL IA</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <LgpdConsentModal
        visible={showLgpdModal}
        onAccept={async () => {
          await saveLgpdConsent(true);
          setHasLgpdConsent(true);
          setShowLgpdModal(false);
          executeTryOn();
        }}
        onDecline={() => {
          setShowLgpdModal(false);
        }}
        isDark={isDark}
      />

      <TryOnResultModal
        visible={showResultModal}
        tryOnData={tryOnApiResponse}
        personImage={personImage}
        garmentName={selectedProduct?.name || 'Peça Selecionada'}
        errorMessage={error}
        onClose={() => setShowResultModal(false)}
        onTryAnother={() => {
          setShowResultModal(false);
          onNavigateToCatalog();
        }}
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
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  stepCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  stepHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '900',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
  },
  catalogHorizontal: {
    flexDirection: 'row',
  },
  cardItemWrapper: {
    width: 150,
    marginRight: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  optionBtn: {
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
  optionBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    gap: 8,
    marginTop: 14,
  },
  loadingProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  generateBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
