/**
 * Supabase client with the SECRET key: bypasses RLS. Server-only.
 * Allowed uses (keep this list short and in the README):
 *   - rate limiter (public.hit_rate_limit)
 *   - inserting anonymous "report outdated info" flags after rate limiting
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

export function createSupabaseServiceClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  const secret = serverEnv().SUPABASE_SECRET_KEY;
  if (!config || !secret) return null;
  return createClient(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
