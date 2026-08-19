// server/config/env.ts
import dotenv from 'dotenv';

// Explicitly load .env file
dotenv.config();

export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  BACKEND_PUBLIC_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  GOOGLE_IMAGE_MODEL: string;
  GOOGLE_API_KEY?: string;
  PERFECTCORP_API_KEY?: string;
  PERFECTCORP_API_HOST: string;
  TRY_ON_RESULTS_TTL_DAYS: number;
  isSupabaseConfigured: boolean;
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

function isNotPlaceholder(val: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase();
  return (
    !lower.includes('your-supabase') &&
    !lower.includes('your-') &&
    !lower.includes('placeholder') &&
    !lower.includes('demo-supabase') &&
    !lower.includes('demo-service') &&
    lower !== 'none' &&
    lower !== 'null' &&
    lower !== 'undefined'
  );
}

/**
 * Validates required environment variables on startup.
 * Strictly avoids fake/demo keys and guarantees never falling back to fake URLs.
 */
export function validateEnv(): EnvConfig {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const BACKEND_PUBLIC_URL = (
    process.env.BACKEND_PUBLIC_URL?.trim() ||
    process.env.PUBLIC_URL?.trim() ||
    `http://localhost:${PORT}`
  ).replace(/\/+$/, '');

  const rawSupabaseUrl = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const rawServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const rawAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  const isSupabaseConfigured = Boolean(
    rawSupabaseUrl &&
    isValidHttpUrl(rawSupabaseUrl) &&
    isNotPlaceholder(rawSupabaseUrl) &&
    rawServiceKey &&
    rawServiceKey.length > 20 &&
    isNotPlaceholder(rawServiceKey)
  );

  const SUPABASE_URL = isSupabaseConfigured ? rawSupabaseUrl : '';
  const SUPABASE_SERVICE_ROLE_KEY = isSupabaseConfigured ? rawServiceKey : '';
  const SUPABASE_ANON_KEY = isNotPlaceholder(rawAnonKey) ? rawAnonKey : '';

  const GOOGLE_IMAGE_MODEL = process.env.GOOGLE_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image';
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();

  const PERFECTCORP_API_KEY = process.env.PERFECTCORP_API_KEY?.trim() || process.env.PERFECT_CORP_API_KEY?.trim();
  const PERFECTCORP_API_HOST = process.env.PERFECTCORP_API_HOST?.trim() || 'https://yce-api-01.makeupar.com';

  const TRY_ON_RESULTS_TTL_DAYS = parseInt(process.env.TRY_ON_RESULTS_TTL_DAYS || '7', 10);

  return {
    PORT,
    NODE_ENV,
    BACKEND_PUBLIC_URL,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY,
    GOOGLE_IMAGE_MODEL,
    GOOGLE_API_KEY,
    PERFECTCORP_API_KEY,
    PERFECTCORP_API_HOST,
    TRY_ON_RESULTS_TTL_DAYS,
    isSupabaseConfigured,
  };
}

export const env = validateEnv();
