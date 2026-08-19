// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  SupabaseConfigStatus,
  checkSupabaseConnectivity,
} from '../lib/supabase';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface SignUpResult {
  error: Error | null;
  requiresEmailConfirmation?: boolean;
  user?: User | null;
}

export interface AuthContextType {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  isConfigured: boolean;
  configStatus: SupabaseConfigStatus;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
  checkConnectivity: typeof checkSupabaseConnectivity;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Listeners for session expiration (401) events from authenticatedFetch
type UnauthListener = () => void;
const unauthListeners = new Set<UnauthListener>();

export function notifySessionExpired() {
  unauthListeners.forEach(listener => {
    try {
      listener();
    } catch {
      // Ignore
    }
  });
}

function mapSupabaseAuthError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada para confirmar a conta antes de entrar.';
  }
  if (lower.includes('user already registered') || lower.includes('user_already_exists')) {
    return 'Este e-mail já está cadastrado. Alterne para a aba "Entrar".';
  }
  if (lower.includes('password should be at least') || lower.includes('weak_password')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  if (lower.includes('signups not allowed') || lower.includes('signup_disabled')) {
    return 'Novos cadastros estão temporariamente desativados neste projeto.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('econnrefused')) {
    return 'Falha de conexão com o Supabase. Verifique sua internet e a URL configurada.';
  }
  return rawMessage;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const configStatus = getSupabaseConfigStatus();

  const applySession = useCallback((currentSession: Session | null) => {
    const sessionExists = Boolean(currentSession);
    const hasAccessToken = Boolean(currentSession?.access_token);
    const userIdExists = Boolean(currentSession?.user?.id);
    const supabaseConfigured = isSupabaseConfigured;

    // Safe debug log (Requirement 17: NEVER logs tokens, JWTs, keys, or secrets)
    console.log(
      `[AUTH_CHECK] sessionExists=${sessionExists} hasAccessToken=${hasAccessToken} userIdExists=${userIdExists} supabaseConfigured=${supabaseConfigured}`
    );

    if (currentSession?.access_token && currentSession.user) {
      setSession(currentSession);
      setUser(currentSession.user);
      setStatus('authenticated');
    } else {
      setSession(null);
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      applySession(null);
      return;
    }

    async function initAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data?.session) {
          if (isMounted) {
            applySession(null);
          }
          return;
        }
        if (isMounted) {
          applySession(data.session);
        }
      } catch {
        if (isMounted) {
          applySession(null);
        }
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        applySession(newSession);
      }
    });

    const handleExpired = () => {
      if (isMounted) {
        applySession(null);
      }
    };
    unauthListeners.add(handleExpired);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      unauthListeners.delete(handleExpired);
    };
  }, [applySession]);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error('Serviço de autenticação não configurado (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY ausentes).'),
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: new Error(mapSupabaseAuthError(error.message)) };
      }

      if (data?.session) {
        applySession(data.session);
      }

      return { error: null };
    } catch (err: any) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      return { error: new Error(mapSupabaseAuthError(rawMsg)) };
    }
  };

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error('Serviço de autenticação não configurado (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY ausentes).'),
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        return {
          error: new Error(mapSupabaseAuthError(error.message)),
        };
      }

      // Case A: Email confirmation disabled in Supabase project -> returns active session directly
      if (data?.session) {
        applySession(data.session);
        return {
          error: null,
          requiresEmailConfirmation: false,
          user: data.user,
        };
      }

      // Case B: Email confirmation enabled -> user created, but session is null until verified
      if (data?.user) {
        return {
          error: null,
          requiresEmailConfirmation: true,
          user: data.user,
        };
      }

      return {
        error: new Error('Não foi possível concluir o cadastro no momento.'),
      };
    } catch (err: any) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      return {
        error: new Error(mapSupabaseAuthError(rawMsg)),
      };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } finally {
      applySession(null);
    }
  };

  const refreshSession = async (): Promise<Session | null> => {
    if (!isSupabaseConfigured) {
      applySession(null);
      return null;
    }

    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data?.session) {
        applySession(null);
        return null;
      }
      applySession(data.session);
      return data.session;
    } catch {
      applySession(null);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        session,
        isConfigured: isSupabaseConfigured,
        configStatus,
        signIn,
        signUp,
        signOut,
        refreshSession,
        checkConnectivity: checkSupabaseConnectivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
