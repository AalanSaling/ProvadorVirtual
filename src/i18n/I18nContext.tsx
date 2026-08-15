// src/i18n/I18nContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageCode, Translations, translations } from './translations';

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: keyof Translations) => string;
  strings: Translations;
  languages: { code: LanguageCode; label: string; flag: string }[];
}

const LANGUAGE_STORAGE_KEY = '@provador_app_language_v1';

const AVAILABLE_LANGUAGES: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const I18nContext = createContext<I18nContextType>({
  language: 'pt',
  setLanguage: () => {},
  t: (key: keyof Translations) => translations.pt[key] || String(key),
  strings: translations.pt,
  languages: AVAILABLE_LANGUAGES,
});

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<LanguageCode>('pt');

  useEffect(() => {
    async function loadSavedLanguage() {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved === 'pt' || saved === 'es') {
          setLanguageState(saved);
        }
      } catch {
        // Fallback gracefully to default 'pt'
      }
    }
    loadSavedLanguage();
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore async storage error in non-persistent web environments
    }
  };

  const currentTranslations = translations[language] || translations.pt;

  const t = (key: keyof Translations): string => {
    return currentTranslations[key] || translations.pt[key] || String(key);
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        strings: currentTranslations,
        languages: AVAILABLE_LANGUAGES,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
