// src/components/TryOnResultModal.tsx
import React from 'react';
import { View, Text, Modal, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { X, Sparkles, ShoppingBag, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react-native';
import { TryOnApiResponse } from '../services/vtonService';

interface TryOnResultModalProps {
  visible: boolean;
  tryOnData: TryOnApiResponse | null;
  personImage: string | null;
  garmentName: string;
  errorMessage?: string | null;
  onClose: () => void;
  onTryAnother: () => void;
  isDark?: boolean;
}

export const TryOnResultModal: React.FC<TryOnResultModalProps> = ({
  visible,
  tryOnData,
  personImage,
  garmentName,
  errorMessage,
  onClose,
  onTryAnother,
  isDark = true,
}) => {
  if (!visible) return null;

  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const innerBg = isDark ? '#1e293b' : '#f8fafc';

  const perfectCorpRes = tryOnData?.results?.perfectcorp;
  const googleRes = tryOnData?.results?.google;
  const isBoth = tryOnData?.mode === 'both';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.sparkleBox}>
                <Sparkles color="#ffffff" size={18} />
              </View>
              <View>
                <Text style={[styles.title, { color: textColor }]}>Provador Virtual IA Real</Text>
                <Text style={[styles.subtitle, { color: subTextColor }]}>
                  {isBoth ? 'Modo Comparativo (Ambos os Provedores)' : 'Resultado do Processamento'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
              <X color={subTextColor} size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* General Error (if network/server error before provider execution) */}
            {errorMessage ? (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(244, 63, 94, 0.1)', borderColor: '#f43f5e' }]}>
                <AlertCircle color="#f43f5e" size={28} />
                <View style={styles.errorTextCol}>
                  <Text style={styles.errorTitle}>Não foi possível gerar o provador virtual</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              </View>
            ) : null}

            {/* Product Title Badge */}
            <View style={[styles.productBadge, { backgroundColor: innerBg, borderColor }]}>
              <Text style={[styles.productBadgeLabel, { color: subTextColor }]}>PEÇA EXPERIMENTADA:</Text>
              <Text style={[styles.productBadgeName, { color: textColor }]}>{garmentName}</Text>
            </View>

            {/* RESULTS DISPLAY */}
            {isBoth ? (
              <View style={styles.resultsStack}>
                {/* 1. Perfect Corp Result Card */}
                <View style={[styles.providerResultCard, { backgroundColor: innerBg, borderColor }]}>
                  <View style={styles.providerHeader}>
                    <Text style={[styles.providerName, { color: textColor }]}>RESULTADO PERFECT CORP</Text>
                    {perfectCorpRes?.status === 'success' ? (
                      <View style={styles.successTag}>
                        <CheckCircle2 color="#10b981" size={12} />
                        <Text style={styles.successTagText}>Concluído</Text>
                      </View>
                    ) : (
                      <View style={styles.failTag}>
                        <ShieldAlert color="#f43f5e" size={12} />
                        <Text style={styles.failTagText}>Falhou</Text>
                      </View>
                    )}
                  </View>

                  {perfectCorpRes?.status === 'success' && perfectCorpRes.image ? (
                    <Image source={{ uri: perfectCorpRes.image }} style={styles.resultImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.failedBox}>
                      <AlertCircle color="#f43f5e" size={24} />
                      <Text style={styles.failedTitle}>
                        {perfectCorpRes?.errorCode || 'PERFECTCORP_PROVIDER_ERROR'}
                      </Text>
                      <Text style={styles.failedText}>
                        {perfectCorpRes?.errorMessage || 'Não foi possível gerar com a Perfect Corp neste momento.'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* 2. Google Result Card */}
                <View style={[styles.providerResultCard, { backgroundColor: innerBg, borderColor }]}>
                  <View style={styles.providerHeader}>
                    <Text style={[styles.providerName, { color: textColor }]}>RESULTADO GOOGLE</Text>
                    {googleRes?.status === 'success' ? (
                      <View style={styles.successTag}>
                        <CheckCircle2 color="#10b981" size={12} />
                        <Text style={styles.successTagText}>Concluído</Text>
                      </View>
                    ) : (
                      <View style={styles.failTag}>
                        <ShieldAlert color="#f43f5e" size={12} />
                        <Text style={styles.failTagText}>Falhou</Text>
                      </View>
                    )}
                  </View>

                  {googleRes?.status === 'success' && googleRes.image ? (
                    <Image source={{ uri: googleRes.image }} style={styles.resultImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.failedBox}>
                      <AlertCircle color="#f43f5e" size={24} />
                      <Text style={styles.failedTitle}>
                        {googleRes?.errorCode || 'GOOGLE_PROVIDER_ERROR'}
                      </Text>
                      <Text style={styles.failedText}>
                        {googleRes?.errorMessage || 'Não foi possível gerar com o Google Gemini neste momento.'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              /* SINGLE PROVIDER RESULT DISPLAY */
              <View style={styles.resultsStack}>
                {perfectCorpRes && (
                  <View style={[styles.providerResultCard, { backgroundColor: innerBg, borderColor }]}>
                    <Text style={[styles.providerName, { color: textColor, marginBottom: 8 }]}>
                      RESULTADO PERFECT CORP
                    </Text>
                    {perfectCorpRes.status === 'success' && perfectCorpRes.image ? (
                      <Image source={{ uri: perfectCorpRes.image }} style={styles.resultImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.failedBox}>
                        <AlertCircle color="#f43f5e" size={24} />
                        <Text style={styles.failedTitle}>{perfectCorpRes.errorCode}</Text>
                        <Text style={styles.failedText}>{perfectCorpRes.errorMessage}</Text>
                      </View>
                    )}
                  </View>
                )}

                {googleRes && (
                  <View style={[styles.providerResultCard, { backgroundColor: innerBg, borderColor }]}>
                    <Text style={[styles.providerName, { color: textColor, marginBottom: 8 }]}>
                      RESULTADO GOOGLE
                    </Text>
                    {googleRes.status === 'success' && googleRes.image ? (
                      <Image source={{ uri: googleRes.image }} style={styles.resultImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.failedBox}>
                        <AlertCircle color="#f43f5e" size={24} />
                        <Text style={styles.failedTitle}>{googleRes.errorCode}</Text>
                        <Text style={styles.failedText}>{googleRes.errorMessage}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onTryAnother}
              style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}
            >
              <ShoppingBag color="#ffffff" size={16} />
              <Text style={styles.actionBtnText}>Escolher Outra Peça do Catálogo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}
            >
              <Text style={[styles.closeBtnText, { color: textColor }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparkleBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
  },
  closeIconBtn: {
    padding: 4,
  },
  scrollArea: {
    maxHeight: 460,
  },
  scrollContent: {
    gap: 12,
    paddingVertical: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  errorTextCol: {
    flex: 1,
  },
  errorTitle: {
    color: '#f43f5e',
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
  },
  productBadge: {
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productBadgeLabel: {
    fontSize: 10,
    fontWeight: '900',
  },
  productBadgeName: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  resultsStack: {
    gap: 12,
  },
  providerResultCard: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerName: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  successTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  successTagText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  failTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  failTagText: {
    color: '#f43f5e',
    fontSize: 10,
    fontWeight: '800',
  },
  resultImage: {
    width: '100%',
    height: 300,
    borderRadius: 14,
  },
  failedBox: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    alignItems: 'center',
    gap: 6,
  },
  failedTitle: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '800',
  },
  failedText: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  closeBtn: {
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
