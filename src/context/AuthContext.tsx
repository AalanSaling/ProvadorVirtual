// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextType {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const applySession = useCallback((currentSession: Session | null) => {
    const sessionExists = Boolean(currentSession);
    const hasAccessToken = Boolean(currentSession?.access_token);
    const userIdExists = Boolean(currentSession?.user?.id);

    // Safe debug log (Requirement 9: never logs tokens, JWTs, or API keys)
    console.log(`[AUTH_CHECK] sessionExists=${sessionExists} hasAccessToken=${hasAccessToken} userIdExists=${userIdExists}`);

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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: new Error(error.message) };
      }
      if (data?.session) {
        applySession(data.session);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signUp = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        return { error: new Error(error.message) };
      }
      if (data?.session) {
        applySession(data.session);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } finally {
      applySession(null);
    }
  };

  const refreshSession = async (): Promise<Session | null> => {
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
        signIn,
        signUp,
        signOut,
        refreshSession,
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
