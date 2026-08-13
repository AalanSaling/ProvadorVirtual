// src/lib/storage.ts
// Gerenciamento de armazenamento seguro de chaves, senhas e consentimento LGPD

import { ClothingItem, SavedTryOn } from '../types';
import { initialCatalog } from '../data/catalog';

const API_KEY_STORAGE = 'provador_virtual_api_key';
const ADMIN_PWD_STORAGE = 'provador_virtual_admin_password';
const USER_PHOTO_STORAGE = 'provador_virtual_user_photo';
const CATALOG_STORAGE = 'provador_virtual_custom_catalog';
const TRYON_HISTORY_STORAGE = 'provador_virtual_history';
const LGPD_CONSENT_STORAGE = 'provador_virtual_lgpd_consent';

// Memory cache fallback para Web
let inMemoryApiKey: string | null = null;
let inMemoryAdminPassword: string | null = null;

// API Key (PerfectCorp / Replicate)
export function getApiKey(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(API_KEY_STORAGE) || inMemoryApiKey;
    }
  } catch {
    // Fallback
  }
  return inMemoryApiKey;
}

export function saveApiKey(key: string): void {
  const trimmed = key.trim();
  inMemoryApiKey = trimmed;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(API_KEY_STORAGE, trimmed);
    }
  } catch (e) {
    console.error('Erro ao salvar API key em storage local:', e);
  }
}

export function deleteApiKey(): void {
  inMemoryApiKey = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  } catch (e) {
    console.error('Erro ao remover API key:', e);
  }
}

// Senha de Administrador para CRUD de produtos
export function getAdminPassword(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(ADMIN_PWD_STORAGE) || inMemoryAdminPassword;
    }
  } catch {
    // Fallback
  }
  return inMemoryAdminPassword;
}

export function saveAdminPassword(password: string): void {
  const trimmed = password.trim();
  inMemoryAdminPassword = trimmed;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ADMIN_PWD_STORAGE, trimmed);
    }
  } catch (e) {
    console.error('Erro ao salvar senha administrativa:', e);
  }
}

export function deleteAdminPassword(): void {
  inMemoryAdminPassword = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_PWD_STORAGE);
    }
  } catch (e) {
    console.error('Erro ao remover senha administrativa:', e);
  }
}

// LGPD Consent
export function hasUserConsentedLgpd(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(LGPD_CONSENT_STORAGE) === 'true';
    }
  } catch {
    return false;
  }
  return false;
}

export function saveLgpdConsent(consented: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LGPD_CONSENT_STORAGE, consented ? 'true' : 'false');
    }
  } catch (e) {
    console.error('Erro ao salvar consentimento LGPD:', e);
  }
}

// Foto temporária do usuário
export function getSavedUserPhoto(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(USER_PHOTO_STORAGE);
    }
  } catch {
    return null;
  }
  return null;
}

export function saveUserPhoto(photoDataUri: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_PHOTO_STORAGE, photoDataUri);
    }
  } catch (e) {
    console.error('Erro ao salvar foto do usuário:', e);
  }
}

export function removeSavedUserPhoto(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USER_PHOTO_STORAGE);
    }
  } catch (e) {
    console.error('Erro ao remover foto do usuário:', e);
  }
}

// Catálogo
export function getStoredCatalog(): ClothingItem[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CATALOG_STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.error('Erro ao carregar catálogo local:', e);
  }
  return initialCatalog;
}

export function saveStoredCatalog(catalog: ClothingItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CATALOG_STORAGE, JSON.stringify(catalog));
    }
  } catch (e) {
    console.error('Erro ao salvar catálogo:', e);
  }
}

// Histórico de Provador
export function getTryOnHistory(): SavedTryOn[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(TRYON_HISTORY_STORAGE);
      return raw ? JSON.parse(raw) : [];
    }
  } catch {
    return [];
  }
  return [];
}

export function addTryOnToHistory(item: SavedTryOn): void {
  try {
    const current = getTryOnHistory();
    const updated = [item, ...current.slice(0, 19)];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TRYON_HISTORY_STORAGE, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Erro ao salvar histórico de provador:', e);
  }
}
