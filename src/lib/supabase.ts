// src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

declare const window: any;

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

function isValidHttpUrl(stringUrl: string): boolean {
  if (!stringUrl) return false;
  try {
    const url = new URL(stringUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeSupabaseUrl(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const dashboardMatch = trimmed.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }
  return trimmed.replace(/\/+$/, '');
}

function resolvePublicConfig(): { url: string; key: string } {
  // 1. Check window.__EXPO_PUBLIC_ENV__ (injected into HTML by Express server)
  let windowUrl = '';
  let windowKey = '';
  if (typeof window !== 'undefined' && window?.__EXPO_PUBLIC_ENV__) {
    const envObj = window.__EXPO_PUBLIC_ENV__;
    if (envObj.EXPO_PUBLIC_SUPABASE_URL && isNotPlaceholder(envObj.EXPO_PUBLIC_SUPABASE_URL)) {
      windowUrl = String(envObj.EXPO_PUBLIC_SUPABASE_URL).trim();
    }
    if (envObj.EXPO_PUBLIC_SUPABASE_ANON_KEY && isNotPlaceholder(envObj.EXPO_PUBLIC_SUPABASE_ANON_KEY)) {
      windowKey = String(envObj.EXPO_PUBLIC_SUPABASE_ANON_KEY).trim();
    }
  }

  // 2. Check process.env (inlined at build time by Expo/Metro)
  let envUrl = '';
  let envKey = '';
  if (typeof process !== 'undefined' && process?.env) {
    const pUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    if (pUrl && isNotPlaceholder(pUrl)) {
      envUrl = pUrl;
    }
    const pKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    if (pKey && isNotPlaceholder(pKey)) {
      envKey = pKey;
    }
  }

  const rawCandidate = windowUrl || envUrl;
  const url = normalizeSupabaseUrl(rawCandidate);
  const key = windowKey || envKey;

  return { url, key };
}

const { url: rawUrl, key: rawKey } = resolvePublicConfig();

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

export interface SupabaseConnectivityResult {
  ok: boolean;
  status: ConnectivityStatus;
  urlReachable: boolean;
  authReachable: boolean;
  message: string;
}

/**
 * Checks real connectivity against Supabase via an explicit HTTP health check
 * to the public /auth/v1/settings endpoint, without requiring login or session.
 */
export async function checkSupabaseConnectivity(): Promise<SupabaseConnectivityResult> {
  if (!isSupabaseConfigured) {
    console.log('[SUPABASE_DIAGNOSTIC] configured=false urlReachable=false authReachable=false sessionExists=false');
    return {
      ok: false,
      status: 'CONFIG_ERROR',
      urlReachable: false,
      authReachable: false,
      message: 'Serviço de autenticação não configurado no cliente (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY ausentes).',
    };
  }

  try {
    const settingsUrl = `${clientUrl}/auth/v1/settings`;
    const response = await fetch(settingsUrl, {
      method: 'GET',
      headers: {
        'apikey': clientKey,
        'Authorization': `Bearer ${clientKey}`,
      },
    });

    const isAuthReachable = response.ok;
    const isUrlReachable = response.status !== 0 && response.status !== 404;

    console.log(
      `[SUPABASE_DIAGNOSTIC] configured=true urlReachable=${isUrlReachable} authReachable=${isAuthReachable} httpStatus=${response.status}`
    );

    if (response.ok) {
      return {
        ok: true,
        status: 'HEALTHY',
        urlReachable: true,
        authReachable: true,
        message: 'Conexão com Supabase Auth estabelecida com sucesso.',
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: 'SUPABASE_AUTH_ERROR',
        urlReachable: true,
        authReachable: false,
        message: 'Chave pública (ANON_KEY) inválida ou expirada no projeto Supabase.',
      };
    }

    return {
      ok: false,
      status: 'SUPABASE_AUTH_ERROR',
      urlReachable: isUrlReachable,
      authReachable: false,
      message: `Supabase Auth respondeu com status ${response.status} (${response.statusText}).`,
    };
  } catch (err: any) {
    console.log(
      `[SUPABASE_DIAGNOSTIC] configured=true urlReachable=false authReachable=false errorType=network error=${err?.message}`
    );
    return {
      ok: false,
      status: 'NETWORK_ERROR',
      urlReachable: false,
      authReachable: false,
      message: err?.message || 'Falha de rede ao conectar ao Supabase.',
    };
  }
}
