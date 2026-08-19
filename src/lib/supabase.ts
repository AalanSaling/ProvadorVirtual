// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) &&
  !rawUrl.includes('placeholder') &&
  rawKey &&
  rawKey.length > 20
);

const isWebEnvironment = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Cross-platform session storage engine that persists session on both Mobile (AsyncStorage) and Web (localStorage)
const crossPlatformAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (isWebEnvironment) {
        return window.localStorage.getItem(key);
      }
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (isWebEnvironment) {
        window.localStorage.setItem(key, value);
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch {
      // Ignore storage error
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (isWebEnvironment) {
        window.localStorage.removeItem(key);
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore removal error
    }
  },
};

const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://demo-supabase-project.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.demo-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: crossPlatformAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});


