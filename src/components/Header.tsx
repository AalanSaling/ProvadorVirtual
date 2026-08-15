// src/components/Header.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, Globe, Store } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '../theme';
import { useI18n } from '../i18n';

interface HeaderProps {
  storeName?: string;
  subtitle?: string;
  onPressStore?: () => void;
  badge?: string;
}

export function Header({
  storeName,
  subtitle,
  onPressStore,
  badge,
}: HeaderProps) {
  const { language, setLanguage, t } = useI18n();

  const displayStoreName = storeName || t('storeName');
  const displaySubtitle = subtitle || t('storeSubtitle');
  const displayBadge = badge || t('liveBadge');

  const toggleLanguage = () => {
    setLanguage(language === 'pt' ? 'es' : 'pt');
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={styles.iconContainer}>
          <Sparkles size={17} color={colors.accent} />
        </View>
        <View>
          <View style={styles.storeRow}>
            <Text style={styles.storeName}>{displayStoreName}</Text>
            {displayBadge ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{displayBadge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle}>{displaySubtitle}</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        {/* Quick Language Toggle Pill */}
        <TouchableOpacity
          style={styles.langButton}
          onPress={toggleLanguage}
          activeOpacity={0.8}
          accessibilityLabel={t('switchLanguage')}
        >
          <Globe size={13} color={colors.accent} />
          <Text style={styles.langText}>{language === 'pt' ? 'PT' : 'ES'}</Text>
          <View style={styles.langIndicator}>
            <Text style={styles.langFlag}>{language === 'pt' ? '🇧🇷' : '🇪🇸'}</Text>
          </View>
        </TouchableOpacity>

        {onPressStore && (
          <TouchableOpacity style={styles.storeButton} onPress={onPressStore} activeOpacity={0.7}>
            <Store size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 1.0,
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 0.8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 5,
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  langIndicator: {
    marginLeft: 1,
  },
  langFlag: {
    fontSize: 11,
  },
  storeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
