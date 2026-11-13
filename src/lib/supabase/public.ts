/**
 * Cookie-free Supabase client for PUBLIC content reads inside cached ('use cache')
 * functions. Uses the publishable key, so RLS returns only published rows.
 * Never use it for anything user-specific.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/env";

export function createSupabasePublicClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
