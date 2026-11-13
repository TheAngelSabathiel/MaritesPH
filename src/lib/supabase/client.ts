/**
 * Supabase client for Client Components (browser). Uses only the publishable
 * key; all access is limited by Row Level Security.
 */
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.key);
}
