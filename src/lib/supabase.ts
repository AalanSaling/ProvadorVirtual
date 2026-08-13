// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};

export const supabaseUrlResolved =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.EXPO_PUBLIC_SUPABASE_URL ||
  '';

export const supabaseAnonKeyResolved =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrlResolved) &&
    Boolean(supabaseAnonKeyResolved) &&
    !supabaseUrlResolved.includes('placeholder')
  );
};

if (!isSupabaseConfigured() && process.env.NODE_ENV === 'production') {
  console.warn(
    'Aviso: Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env para sincronização remota.'
  );
}

export const supabase = createClient(
  supabaseUrlResolved || 'https://placeholder.supabase.co',
  supabaseAnonKeyResolved || 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
    },
  }
);
