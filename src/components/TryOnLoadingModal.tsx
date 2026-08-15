// src/components/TryOnLoadingModal.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { Sparkles, Shirt, Wand2, CheckCircle2 } from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { useI18n } from '../i18n';

interface TryOnLoadingModalProps {
  visible: boolean;
  storeName?: string;
}

export function TryOnLoadingModal({ visible, storeName }: TryOnLoadingModalProps) {
  const { t } = useI18n();
  const [phaseIndex, setPhaseIndex] = useState(0);

  const displayStoreName = storeName || t('storeName');

  const PHASES = [
    { icon: Shirt, key: 'loadingStep1' as const },
    { icon: Wand2, key: 'loadingStep2' as const },
    { icon: Sparkles, key: 'loadingStep3' as const },
    { icon: CheckCircle2, key: 'loadingStep4' as const },
  ];

  useEffect(() => {
    if (!visible) {
      setPhaseIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setPhaseIndex(prev => (prev < PHASES.length - 1 ? prev + 1 : prev));
    }, 2800);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const currentPhase = PHASES[phaseIndex];
  const IconComponent = currentPhase.icon;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.glowOuter}>
            <View style={styles.iconContainer}>
              <IconComponent size={26} color={colors.accent} />
            </View>
          </View>

          <Text style={styles.storeTag}>{displayStoreName} · {t('aiFashionBadge')}</Text>
          <Text style={styles.phaseTitle}>{t(currentPhase.key)}</Text>
          <Text style={styles.phaseSubtext}>{t('loadingSubtext')}</Text>

          <View style={styles.progressContainer}>
            {PHASES.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.progressDot,
                  idx <= phaseIndex ? styles.progressDotActive : styles.progressDotInactive,
                ]}
              />
            ))}
          </View>

          <View style={styles.spinnerRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.waitNotice}>{t('loadingWait')}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 8, 10, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xxl,
    alignItems: 'center',
    ...shadows.modal,
  },
  glowOuter: {
    padding: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accentGlow,
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeTag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  phaseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  phaseSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: spacing.lg,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xl,
  },
  progressDot: {
    height: 4,
    borderRadius: borderRadius.full,
  },
  progressDotActive: {
    width: 22,
    backgroundColor: colors.accent,
  },
  progressDotInactive: {
    width: 6,
    backgroundColor: colors.borderLight,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waitNotice: {
    fontSize: 11,
    color: colors.textTertiary,
  },
});
