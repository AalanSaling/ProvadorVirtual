// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Sparkles,
  User,
  Lock,
  Mail,
  ArrowRight,
  LogOut,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Server,
  Key,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';

export function LoginScreen() {
  const { user, status, signIn, signUp, signOut, isConfigured, configStatus, connectivityStatus } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  async function handleAuth() {
    setErrorMessage(null);
    setSuccessInfo(null);

    if (!isConfigured) {
      const msg = 'Serviço de autenticação não configurado. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.';
      setErrorMessage(msg);
      Alert.alert('Supabase Não Configurado', msg);
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      const msg = 'Informe seu e-mail e senha para continuar.';
      setErrorMessage(msg);
      Alert.alert('Campos Obrigatórios', msg);
      return;
    }

    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      const msg = 'Informe um endereço de e-mail válido.';
      setErrorMessage(msg);
      Alert.alert('E-mail Inválido', msg);
      return;
    }

    if (password.length < 6) {
      const msg = 'A senha deve conter no mínimo 6 caracteres.';
      setErrorMessage(msg);
      Alert.alert('Senha Curta', msg);
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const result = await signUp(trimmedEmail, password);
      setLoading(false);

      if (result.error) {
        setErrorMessage(result.error.message);
        Alert.alert('Erro no Cadastro', result.error.message);
      } else if (result.requiresEmailConfirmation) {
        const infoMsg = `Conta criada com sucesso! Enviamos um link de confirmação para ${trimmedEmail}. Por favor, confirme seu e-mail antes de fazer login.`;
        setSuccessInfo(infoMsg);
        setIsSignUp(false); // Switch to login tab so they can sign in after confirming
        Alert.alert('Confirmação Necessária', infoMsg);
      } else {
        // Immediate login
        setSuccessInfo('Conta criada e autenticada com sucesso!');
      }
    } else {
      const result = await signIn(trimmedEmail, password);
      setLoading(false);

      if (result.error) {
        setErrorMessage(result.error.message);
        Alert.alert('Erro ao Entrar', result.error.message);
      }
    }
  }

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            {/* Logo & Brand Header */}
            <View style={styles.brandHeader}>
              <View style={styles.logoContainer}>
                <Sparkles size={28} color={colors.accent} />
              </View>
              <Text style={styles.brandTitle}>ATELIER MAISON</Text>
              <Text style={styles.brandSubtitle}>PROVADOR VIRTUAL DE ALTA COSTURA</Text>
            </View>

            {/* Supabase Diagnostic Status Banner (Requirement 16) */}
            <View style={[styles.diagnosticCard, !isConfigured && styles.diagnosticCardWarning]}>
              <View style={styles.diagHeaderRow}>
                <Server size={14} color={isConfigured ? colors.success : colors.accent} />
                <Text style={styles.diagTitle}>SUPABASE AUTH DIAGNÓSTICO</Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: isConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isConfigured ? colors.success : colors.error },
                    ]}
                  >
                    {isConfigured ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}
                  </Text>
                </View>
              </View>

              <View style={styles.diagDetailsRow}>
                <View style={styles.diagItem}>
                  <Text style={styles.diagItemLabel}>Supabase:</Text>
                  <Text style={styles.diagItemValue}>
                    {isConfigured ? 'Configurado' : 'Não configurado'}
                  </Text>
                </View>
                <View style={styles.diagItem}>
                  <Text style={styles.diagItemLabel}>Conectividade:</Text>
                  <Text
                    style={[
                      styles.diagItemValue,
                      {
                        color:
                          connectivityStatus === 'HEALTHY'
                            ? colors.success
                            : connectivityStatus === 'NETWORK_ERROR'
                            ? colors.error
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    {connectivityStatus === 'HEALTHY'
                      ? 'Online'
                      : connectivityStatus === 'NETWORK_ERROR'
                      ? 'Indisponível'
                      : isConfigured
                      ? 'Online'
                      : 'Indisponível'}
                  </Text>
                </View>
                <View style={styles.diagItem}>
                  <Text style={styles.diagItemLabel}>Sessão:</Text>
                  <Text style={styles.diagItemValue}>
                    {status === 'authenticated' ? 'Autenticado' : 'Não autenticado'}
                  </Text>
                </View>
              </View>

              {configStatus.urlHost && (
                <Text style={[styles.diagHelpText, { marginTop: 4, color: colors.textTertiary }]}>
                  Host: {configStatus.urlHost}
                </Text>
              )}

              {!isConfigured && (
                <Text style={styles.diagHelpText}>
                  Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env para habilitar autenticação real.
                </Text>
              )}
            </View>

            {user ? (
              /* Logged in User Card */
              <View style={styles.userCard}>
                <View style={styles.userIconCircle}>
                  <User size={24} color={colors.accent} />
                </View>
                <Text style={styles.welcomeLabel}>Sessão Autenticada</Text>
                <Text style={styles.userEmailText}>{user.email || 'Usuário Autenticado'}</Text>

                <View style={styles.verifiedRow}>
                  <ShieldCheck size={14} color={colors.success} />
                  <Text style={styles.verifiedText}>Acesso Seguro Multi-Loja Supabase</Text>
                </View>

                <TouchableOpacity
                  style={styles.signOutButton}
                  onPress={handleSignOut}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.error} size="small" />
                  ) : (
                    <View style={styles.btnRow}>
                      <LogOut size={16} color={colors.error} />
                      <Text style={styles.signOutText}>Sair da Conta</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* Login / Signup Form */
              <View style={styles.formCard}>
                {/* Tab selector between Entrar and Criar Conta */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tabButton, !isSignUp && styles.tabButtonActive]}
                    onPress={() => {
                      setIsSignUp(false);
                      setErrorMessage(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tabButtonText, !isSignUp && styles.tabButtonTextActive]}>
                      Entrar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabButton, isSignUp && styles.tabButtonActive]}
                    onPress={() => {
                      setIsSignUp(true);
                      setErrorMessage(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tabButtonText, isSignUp && styles.tabButtonTextActive]}>
                      Criar Conta
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.formTitle}>
                  {isSignUp ? 'Criar Conta Exclusiva' : 'Acesse seu Atelier'}
                </Text>
                <Text style={styles.formDesc}>
                  {isSignUp
                    ? 'Cadastre-se para gerenciar provadores, catálogo e motores de IA.'
                    : 'Entre para acessar o provador virtual e o painel administrativo.'}
                </Text>

                {/* Email verification notice / success info */}
                {successInfo && (
                  <View style={styles.successBanner}>
                    <CheckCircle2 size={16} color={colors.success} />
                    <Text style={styles.successBannerText}>{successInfo}</Text>
                  </View>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={16} color={colors.error} />
                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Email Input */}
                <Text style={styles.inputLabel}>E-MAIL</Text>
                <View style={[styles.inputWrapper, !isConfigured && styles.inputDisabled]}>
                  <Mail size={16} color={colors.textTertiary} />
                  <TextInput
                    style={styles.input}
                    placeholder="seu@email.com"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={isConfigured && !loading}
                  />
                </View>

                {/* Password Input */}
                <Text style={styles.inputLabel}>SENHA</Text>
                <View style={[styles.inputWrapper, !isConfigured && styles.inputDisabled]}>
                  <Lock size={16} color={colors.textTertiary} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={isConfigured && !loading}
                  />
                </View>

                {/* Submit CTA */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (!isConfigured || loading) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleAuth}
                  disabled={!isConfigured || loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <View style={styles.btnRow}>
                      <Text style={styles.submitButtonText}>
                        {isSignUp ? 'CRIAR MINHA CONTA' : 'ENTRAR NO ATELIER'}
                      </Text>
                      <ArrowRight size={16} color={colors.textInverse} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Switch Sign in / Sign up link */}
                <TouchableOpacity
                  style={styles.switchModeButton}
                  onPress={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMessage(null);
                    setSuccessInfo(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.switchModeText}>
                    {isSignUp
                      ? 'Já possui uma conta? Entrar'
                      : 'Não possui conta? Cadastre-se gratuitamente'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.cardHover,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  diagnosticCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  diagnosticCardWarning: {
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  diagHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  diagTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  diagDetailsRow: {
    flexDirection: 'column',
    gap: 4,
  },
  diagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  diagItemLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  diagItemValue: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  diagHelpText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    marginTop: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabButtonTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  successBannerText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    flex: 1,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  userIconCircle: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  welcomeLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  userEmailText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xl,
  },
  verifiedText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '600',
  },
  signOutButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.error,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xl,
    ...shadows.card,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  formDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 17,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.cardHover,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 1,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchModeButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  switchModeText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '500',
  },
});
