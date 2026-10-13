import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const globalSupabase = globalThis as typeof globalThis & {
  __ubtSupabase?: SupabaseClient<Database>;
};

// One Auth/Realtime transport per browser context, including Vite HMR remounts.
export const supabase = globalSupabase.__ubtSupabase ?? createClient<Database>(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
});

globalSupabase.__ubtSupabase = supabase;
