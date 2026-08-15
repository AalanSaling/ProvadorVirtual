// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Sparkles, User, Lock, Mail, ArrowRight, LogOut, ShieldCheck } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email || 'Usuário Autenticado');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Campos Obrigatórios', 'Informe seu e-mail e senha para continuar.');
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        Alert.alert('Erro ao Criar Conta', error.message);
      } else {
        Alert.alert('Conta Criada', 'Sua conta foi criada com sucesso.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        Alert.alert('Erro de Acesso', error.message);
      }
    }
  }

  async function handleSignOut() {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Logo & Brand Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoContainer}>
              <Sparkles size={28} color={colors.accent} />
            </View>
            <Text style={styles.brandTitle}>ATELIER MAISON</Text>
            <Text style={styles.brandSubtitle}>PROVADOR VIRTUAL DE ALTA COSTURA</Text>
          </View>

          {userEmail ? (
            /* Logged in User Card */
            <View style={styles.userCard}>
              <View style={styles.userIconCircle}>
                <User size={24} color={colors.accent} />
              </View>
              <Text style={styles.welcomeLabel}>Sessão Autenticada</Text>
              <Text style={styles.userEmailText}>{userEmail}</Text>

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
                  ? 'Cadastre-se para salvar looks, histórico e gerenciar provadores.'
                  : 'Entre para experimentar looks em tempo real com IA.'}
              </Text>

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
                      {isSignUp ? 'CRIAR MINHA CONTA' : 'ENTRAR NO PROVADOR'}
                    </Text>
                    <ArrowRight size={16} color={colors.textInverse} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Switch Sign in / Sign up */}
              <TouchableOpacity
                style={styles.switchModeButton}
                onPress={() => setIsSignUp(!isSignUp)}
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
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
