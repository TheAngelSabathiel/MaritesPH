/**
 * Magic-link confirmation that works across devices (no PKCE verifier needed).
 * Requires the Supabase "Magic Link" email template to link here; see README
 * "Local development setup" > "Auth email template".
 *   /auth/confirm?token_hash=...&type=email&redirect_to=<our /auth/callback URL>
 */
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordConsentIfGiven, signInTargets } from "@/lib/auth/finish-sign-in";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "magiclink", "signup"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  // next/consent travel inside redirect_to (the emailRedirectTo we sent).
  // Only trust it if it points back at this site.
  let next: string | null = null;
  let consent: string | null = null;
  const redirectTo = searchParams.get("redirect_to");
  if (redirectTo) {
    try {
      const target = new URL(redirectTo);
      if (target.origin === origin) {
        next = target.searchParams.get("next");
        consent = target.searchParams.get("consent");
      }
    } catch {
      // Malformed redirect_to: ignore and use defaults.
    }
  }

  const { success, failure } = signInTargets(next);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createSupabaseServerClient();
  if (!supabase || !tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(new URL(failure, origin));
  }

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(new URL(failure, origin));

  await recordConsentIfGiven(supabase, consent);
  return NextResponse.redirect(new URL(success, origin));
}
