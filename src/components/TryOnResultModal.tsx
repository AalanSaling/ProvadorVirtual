// src/components/TryOnResultModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { X, Sparkles, RefreshCw, Camera, Download, Share2 } from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { useI18n } from '../i18n';
import { TryOnResult } from '../types';

interface TryOnResultModalProps {
  visible: boolean;
  result: TryOnResult | null;
  productName?: string;
  onClose: () => void;
  onPickAnotherGarment: () => void;
  onChangePhoto: () => void;
}

export function TryOnResultModal({
  visible,
  result,
  productName,
  onClose,
  onPickAnotherGarment,
  onChangePhoto,
}: TryOnResultModalProps) {
  const { t } = useI18n();
  const displayName = productName || 'Peça Selecionada';

  if (!visible || !result || !result.resultImage) return null;

  function handleSave() {
    Alert.alert(t('savedSuccessTitle'), t('savedSuccessMsg'));
  }

  function handleShare() {
    Alert.alert(t('sharePreparingTitle'), t('sharePreparingMsg'));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.badgeRow}>
                <Sparkles size={12} color={colors.accent} />
                <Text style={styles.badgeText}>{t('lookGeneratedBadge')}</Text>
              </View>
              <Text style={styles.title}>{t('yourLookTitle')}</Text>
              <Text style={styles.productName} numberOfLines={1}>
                {displayName}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Large Image Showcase */}
          <View style={styles.imageCard}>
            <Image
              source={{ uri: result.resultImage }}
              style={styles.resultImage}
              resizeMode="contain"
            />

            <View style={styles.providerTag}>
              <Text style={styles.providerTagText}>✦ {t('aiEngineLabel')}</Text>
            </View>
          </View>

          {/* Actions Panel */}
          <View style={styles.footer}>
            {/* Quick Share / Save Row */}
            <View style={styles.utilityRow}>
              <TouchableOpacity style={styles.utilityButton} onPress={handleSave} activeOpacity={0.8}>
                <Download size={15} color={colors.textPrimary} />
                <Text style={styles.utilityText}>{t('saveLook')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.utilityButton} onPress={handleShare} activeOpacity={0.8}>
                <Share2 size={15} color={colors.textPrimary} />
                <Text style={styles.utilityText}>{t('shareLook')}</Text>
              </TouchableOpacity>
            </View>

            {/* Primary Navigation Actions */}
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={onPickAnotherGarment}
              activeOpacity={0.85}
            >
              <RefreshCw size={15} color={colors.textInverse} />
              <Text style={styles.primaryActionText}>{t('tryAnotherGarment')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={onChangePhoto}
              activeOpacity={0.85}
            >
              <Camera size={15} color={colors.textPrimary} />
              <Text style={styles.secondaryActionText}>{t('changeMyPhoto')}</Text>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleGroup: {
    flex: 1,
    marginRight: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  productName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
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
  imageCard: {
    flex: 1,
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.card,
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  providerTag: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  providerTagText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  footer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 2,
  },
  utilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  utilityText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: borderRadius.md,
    ...shadows.card,
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
