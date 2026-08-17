// src/components/CredentialEditModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ShieldCheck, Lock, X, Eye, EyeOff, Key } from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { useI18n } from '../i18n';

interface CredentialEditModalProps {
  visible: boolean;
  providerId: 'perfectcorp' | 'google' | null;
  providerName: string;
  onClose: () => void;
  onSave: (providerId: 'perfectcorp' | 'google', apiKey: string) => Promise<boolean>;
}

export function CredentialEditModal({
  visible,
  providerId,
  providerName,
  onClose,
  onSave,
}: CredentialEditModalProps) {
  const { t } = useI18n();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!visible || !providerId) return null;

  async function handleSave() {
    if (!apiKey.trim()) {
      setErrorMsg('Por favor, informe a chave da API.');
      return;
    }
    setErrorMsg(null);
    setIsSaving(true);
    try {
      const ok = await onSave(providerId!, apiKey.trim());
      if (ok) {
        setApiKey('');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao salvar credencial no backend seguro.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleClose() {
    setApiKey('');
    setErrorMsg(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.container}
            >
              <View style={styles.modalCard}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerIcon}>
                    <Lock size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{t('credentialModalTitle')}</Text>
                    <Text style={styles.subtitle}>{providerName}</Text>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Security Vault Banner */}
                <View style={styles.vaultBanner}>
                  <ShieldCheck size={16} color={colors.accent} />
                  <Text style={styles.vaultBannerText}>
                    {t('credentialModalDesc')}
                  </Text>
                </View>

                {/* Input Field */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>{t('credentialInputLabel')}</Text>
                  <View style={styles.inputWrapper}>
                    <Key size={16} color={colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={apiKey}
                      onChangeText={text => {
                        setApiKey(text);
                        setErrorMsg(null);
                      }}
                      placeholder={t('credentialInputPlaceholder')}
                      placeholderTextColor={colors.textTertiary}
                      secureTextEntry={!showKey}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowKey(!showKey)}
                      activeOpacity={0.7}
                    >
                      {showKey ? (
                        <EyeOff size={16} color={colors.textSecondary} />
                      ) : (
                        <Eye size={16} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {errorMsg && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleClose}
                    disabled={isSaving}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={isSaving}
                    activeOpacity={0.85}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#07080a" />
                    ) : (
                      <Text style={styles.saveBtnText}>{t('save')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 460,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  vaultBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  vaultBannerText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  inputContainer: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.xs,
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    paddingVertical: 10,
  },
  eyeBtn: {
    padding: spacing.xs,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 11,
    color: colors.error,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#07080a',
  },
});
