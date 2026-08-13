// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabaseUrlResolved =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

export const supabaseAnonKeyResolved =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
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
