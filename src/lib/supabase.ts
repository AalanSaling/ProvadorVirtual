// src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const rawKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

function isValidHttpUrl(stringUrl: string): boolean {
  if (!stringUrl) return false;
  try {
    const url = new URL(stringUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isNotPlaceholder(val: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase();
  return (
    !lower.includes('your-supabase') &&
    !lower.includes('your-') &&
    !lower.includes('placeholder') &&
    !lower.includes('demo-supabase') &&
    !lower.includes('demo-anon') &&
    lower !== 'none' &&
    lower !== 'null' &&
    lower !== 'undefined'
  );
}

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  isValidHttpUrl(rawUrl) &&
  isNotPlaceholder(rawUrl) &&
  rawKey &&
  rawKey.length > 20 &&
  isNotPlaceholder(rawKey)
);

export interface SupabaseConfigStatus {
  configured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  urlHost: string | null;
}

/**
 * Diagnostic function: Returns ONLY non-sensitive status info.
 * NEVER returns keys, tokens, JWTs or secrets.
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  let host: string | null = null;
  if (rawUrl && isValidHttpUrl(rawUrl)) {
    try {
      host = new URL(rawUrl).hostname;
    } catch {
      host = null;
    }
  }

  return {
    configured: isSupabaseConfigured,
    hasUrl: Boolean(rawUrl && isValidHttpUrl(rawUrl) && isNotPlaceholder(rawUrl)),
    hasAnonKey: Boolean(rawKey && rawKey.length > 20 && isNotPlaceholder(rawKey)),
    urlHost: host,
  };
}

const isWebEnvironment = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const memoryStore = new Map<string, string>();

// Cross-platform session storage engine that persists session on Web (localStorage) and Mobile (AsyncStorage)
export const crossPlatformAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (isWebEnvironment) {
        return window.localStorage.getItem(key);
      }
      const val = await AsyncStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
      return memoryStore.get(key) || null;
    } catch {
      return memoryStore.get(key) || null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      memoryStore.set(key, value);
      if (isWebEnvironment) {
        window.localStorage.setItem(key, value);
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch {
      // Memory store is already updated
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      memoryStore.delete(key);
      if (isWebEnvironment) {
        window.localStorage.removeItem(key);
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch {
      // Memory store is already updated
    }
  },
};

/**
 * Real Supabase Client.
 * When not configured, points to https://unconfigured.local with a dummy key to prevent crashes on module load,
 * but isSupabaseConfigured flag strictly prevents fake connections.
 */
const clientUrl = isSupabaseConfigured ? rawUrl : 'https://unconfigured.supabase.local';
const clientKey = isSupabaseConfigured ? rawKey : 'unconfigured_anon_key_0000000000000000000000';

export const supabase: SupabaseClient = createClient(clientUrl, clientKey, {
  auth: {
    storage: crossPlatformAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type ConnectivityStatus = 'CONFIG_ERROR' | 'NETWORK_ERROR' | 'SUPABASE_AUTH_ERROR' | 'HEALTHY';

/**
 * Checks real connectivity against Supabase without using fake mocks.
 */
export async function checkSupabaseConnectivity(): Promise<{
  ok: boolean;
  status: ConnectivityStatus;
  message: string;
}> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      status: 'CONFIG_ERROR',
      message: 'Serviço de autenticação não configurado no cliente (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY ausentes).',
    };
  }

  try {
    const { error } = await supabase.auth.getSession();
    if (error) {
      return {
        ok: false,
        status: 'SUPABASE_AUTH_ERROR',
        message: error.message || 'Falha ao comunicar com Supabase Auth.',
      };
    }
    return {
      ok: true,
      status: 'HEALTHY',
      message: 'Conexão com Supabase Auth estabelecida com sucesso.',
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 'NETWORK_ERROR',
      message: err?.message || 'Falha de rede ao conectar ao Supabase.',
    };
  }
}
