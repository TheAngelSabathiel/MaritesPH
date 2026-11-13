/**
 * Environment variables, validated with Zod.
 *
 * Two groups:
 *  - publicEnv: NEXT_PUBLIC_* values, safe in the browser.
 *  - serverEnv(): secrets. Lives in ./env.server.ts, which imports "server-only"
 *    so the build fails if a Client Component ever imports it.
 *
 * Public values are read with literal `process.env.NEXT_PUBLIC_X` expressions
 * because Next.js inlines them at build time only in that exact form.
 */
import { z } from "zod";

const optionalUrl = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.url().optional(),
);
const optionalString = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().min(1).optional(),
);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    (v) => (v === "" || v === undefined ? "http://localhost:3000" : v),
    z.url(),
  ),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  NEXT_PUBLIC_CONTACT_EMAIL: z.preprocess(
    (v) => (v === "" || v === undefined ? "privacy@example.com" : v),
    z.email(),
  ),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  return publicEnvSchema.parse(source);
}

export const publicEnv: PublicEnv = parsePublicEnv({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
});

/**
 * Supabase is optional at build time so the public site (and CI) can build
 * without secrets. Auth features show a "not configured" notice instead.
 */
export function getSupabasePublicConfig(env: PublicEnv = publicEnv):
  | { url: string; key: string }
  | null {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}
