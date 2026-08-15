// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const isValidUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
const supabaseUrl = isValidUrl ? rawUrl : 'https://demo-supabase-project.supabase.co';

const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAnonKey = (rawKey && rawKey.length > 20) 
  ? rawKey 
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.demo-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

