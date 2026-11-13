/**
 * Server-only configuration. Importing this from a Client Component fails the build.
 * Later phases add their secrets here (ANTHROPIC_API_KEY, RESEND_API_KEY, PAYMONGO_SECRET_KEY, ...).
 */
import "server-only";
import { z } from "zod";

export const serverEnvSchema = z.object({
  /** Content last verified more than this many days ago shows "may be outdated". */
  CONTENT_STALE_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  /**
   * Supabase secret key. Used ONLY for: anonymous "report outdated info" flags
   * (after rate limiting) and the rate limiter itself. Never sent to browsers.
   */
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  /** Salt for hashing IP addresses in rate-limit keys (raw IPs are never stored). */
  RATE_LIMIT_SALT: z.string().min(16).optional(),
  /** 32 random bytes, base64: encrypts TIN, registered name/address, and entry notes. */
  FIELD_ENCRYPTION_KEY: z.string().min(40).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse({
    CONTENT_STALE_DAYS: process.env.CONTENT_STALE_DAYS || undefined,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
    RATE_LIMIT_SALT: process.env.RATE_LIMIT_SALT || undefined,
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY || undefined,
  });
  return cached;
}
