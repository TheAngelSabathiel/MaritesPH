/**
 * Rate limiting on top of public.hit_rate_limit (fixed window, Postgres).
 * Keys never contain raw IP addresses: IPs are hashed with RATE_LIMIT_SALT.
 */
import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** First address in X-Forwarded-For (set by Vercel), else X-Real-IP. */
export function clientIp(get: (name: string) => string | null): string | null {
  const forwarded = get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || get("x-real-ip")?.trim() || null;
}

export type LimitResult = "allowed" | "limited" | "unavailable";

export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<LimitResult> {
  const service = createSupabaseServiceClient();
  if (!service) return "unavailable";
  const { data, error } = await service.rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.code);
    return "unavailable";
  }
  return data === true ? "allowed" : "limited";
}
