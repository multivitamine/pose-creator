// Server-only Supabase client. RLS is disabled on rh_* tables, so the anon key
// has full access from the server. Never import this from client components.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  }
  client = createClient(url, anonKey, { auth: { persistSession: false } });
  return client;
}
