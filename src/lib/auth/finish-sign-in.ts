/**
 * Shared last step of every sign-in path (OAuth/PKCE callback and email
 * token-hash confirmation): record consent if the user gave it, then decide
 * where to send them.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";
import { safeRelativePath } from "@/lib/safe-redirect";

export function localeFromPath(path: string): Locale {
  const first = path.split("/")[1];
  return isLocale(first) ? first : defaultLocale;
}

export async function recordConsentIfGiven(supabase: SupabaseClient, consent: string | null) {
  // Only the CURRENT policy version counts; stale links can't record old consent.
  if (consent !== PRIVACY_POLICY_VERSION) return;
  const { error } = await supabase.rpc("record_privacy_consent", { p_version: PRIVACY_POLICY_VERSION });
  if (error) {
    // Not fatal: the account page asks again when consent is missing.
    // Log the code only, never user data.
    console.error("record_privacy_consent failed", error.code);
  }
}

export function signInTargets(next: string | null) {
  const fallbackLocale = localeFromPath(next ?? "");
  const success = safeRelativePath(next, `/${fallbackLocale}/account`);
  const failure = `/${localeFromPath(success)}/login?error=callback`;
  return { success, failure };
}
