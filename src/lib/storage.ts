// src/lib/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ClothingItem, SavedTryOn } from '../types';
import { initialCatalog } from '../data/catalog';

const USER_PHOTO_KEY = 'provador_virtual_user_photo';
const LGPD_CONSENT_KEY = 'provador_virtual_lgpd_consent';
const CATALOG_KEY = 'provador_virtual_catalog';
const TRYON_HISTORY_KEY = 'provador_virtual_history';

// Safe wrapper for SecureStore / AsyncStorage
async function safeGetSecure(key: string): Promise<string | null> {
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      return await SecureStore.getItemAsync(key);
    }
    return await AsyncStorage.getItem(key);
  } catch (e) {
    return await AsyncStorage.getItem(key);
  }
}

async function safeSetSecure(key: string, value: string): Promise<void> {
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    await AsyncStorage.setItem(key, value);
  }
}

async function safeDeleteSecure(key: string): Promise<void> {
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  } catch (e) {
    await AsyncStorage.removeItem(key);
  }
}

// --- LGPD Consent ---
export async function getLgpdConsent(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(LGPD_CONSENT_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function saveLgpdConsent(consented: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(LGPD_CONSENT_KEY, consented ? 'true' : 'false');
  } catch (e) {
    console.error('Error saving LGPD consent:', e);
  }
}

// --- User Photo (Local only, secure) ---
export async function getSavedUserPhoto(): Promise<string | null> {
  return await safeGetSecure(USER_PHOTO_KEY);
}

export async function saveUserPhoto(photoUri: string): Promise<void> {
  await safeSetSecure(USER_PHOTO_KEY, photoUri);
}

export async function removeSavedUserPhoto(): Promise<void> {
  await safeDeleteSecure(USER_PHOTO_KEY);
}

// --- Local Catalog Storage (fallback before backend API connection) ---
export async function getStoredCatalog(): Promise<ClothingItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading stored catalog:', e);
  }
  return initialCatalog;
}

export async function saveStoredCatalog(catalog: ClothingItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
  } catch (e) {
    console.error('Error saving catalog:', e);
  }
}

// --- Try On History ---
export async function getTryOnHistory(): Promise<SavedTryOn[]> {
  try {
    const raw = await AsyncStorage.getItem(TRYON_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addTryOnToHistory(item: SavedTryOn): Promise<void> {
  try {
    const current = await getTryOnHistory();
    const updated = [item, ...current.slice(0, 19)];
    await AsyncStorage.setItem(TRYON_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving try-on history:', e);
  }
}
