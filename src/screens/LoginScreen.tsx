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
import { Sparkles, User, Lock, Mail, ArrowRight, LogOut, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';

export function LoginScreen() {
  const { user, signIn, signUp, signOut, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAuth() {
    setErrorMessage(null);
    if (!email || !password) {
      const msg = 'Informe seu e-mail e senha para continuar.';
      setErrorMessage(msg);
      Alert.alert('Campos Obrigatórios', msg);
      return;
    }

    if (password.length < 6) {
      const msg = 'A senha deve conter no mínimo 6 caracteres.';
      setErrorMessage(msg);
      Alert.alert('Senha Inválida', msg);
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email.trim(), password);
      setLoading(false);
      if (error) {
        setErrorMessage(error.message);
        Alert.alert('Erro ao Criar Conta', error.message);
      } else {
        Alert.alert('Conta Criada', 'Sua conta foi criada com sucesso.');
      }
    } else {
      const { error } = await signIn(email.trim(), password);
      setLoading(false);
      if (error) {
        setErrorMessage(error.message);
        Alert.alert('Erro de Acesso', error.message);
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

            {/* Supabase configuration warning banner if environment not set */}
            {!isConfigured && (
              <View style={styles.configNotice}>
                <AlertCircle size={16} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.configNoticeTitle}>Configuração Supabase</Text>
                  <Text style={styles.configNoticeDesc}>
                    Para autenticação em produção, defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.
                  </Text>
                </View>
              </View>
            )}

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
                <Text style={styles.formTitle}>
                  {isSignUp ? 'Criar Conta Exclusiva' : 'Acesse seu Atelier'}
                </Text>
                <Text style={styles.formDesc}>
                  {isSignUp
                    ? 'Cadastre-se para gerenciar provadores, catálogo e motores de IA.'
                    : 'Entre para acessar o provador virtual e o painel administrativo.'}
                </Text>

                {errorMessage && (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={14} color={colors.error} />
                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Email Input */}
                <Text style={styles.inputLabel}>E-MAIL</Text>
                <View style={styles.inputWrapper}>
                  <Mail size={16} color={colors.textTertiary} />
                  <TextInput
                    style={styles.input}
                    placeholder="seu@email.com"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                {/* Password Input */}
                <Text style={styles.inputLabel}>SENHA</Text>
                <View style={styles.inputWrapper}>
                  <Lock size={16} color={colors.textTertiary} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                {/* Submit CTA */}
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleAuth}
                  disabled={loading}
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

                {/* Switch Sign in / Sign up */}
                <TouchableOpacity
                  style={styles.switchModeButton}
                  onPress={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMessage(null);
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
    marginBottom: spacing.xl,
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
  configNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  configNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 2,
  },
  configNoticeDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
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
