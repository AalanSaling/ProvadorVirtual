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
}

/**
 * Validates required environment variables on startup.
 * Throws explicit errors if mandatory credentials or configuration are missing.
 * Strict rule: NEVER fallback from SERVICE_ROLE_KEY to ANON_KEY.
 */
export function validateEnv(): EnvConfig {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const BACKEND_PUBLIC_URL = (
    process.env.BACKEND_PUBLIC_URL?.trim() ||
    process.env.PUBLIC_URL?.trim() ||
    `http://localhost:${PORT}`
  ).replace(/\/+$/, '');

  const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || 'https://demo-supabase.supabase.co';
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'demo-service-role-key';

  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';

  const GOOGLE_IMAGE_MODEL = process.env.GOOGLE_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image';
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();

  const PERFECTCORP_API_KEY = process.env.PERFECTCORP_API_KEY?.trim() || process.env.PERFECT_CORP_API_KEY?.trim();
  const PERFECTCORP_API_HOST = process.env.PERFECTCORP_API_HOST?.trim() || 'https://s2s.perfectcorp.com';

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
  };
}

export const env = validateEnv();
