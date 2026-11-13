/**
 * OAuth (Google) and same-browser magic-link callback (PKCE code exchange).
 * Supabase redirects here with ?code=...; we also pass ?next= and ?consent=.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordConsentIfGiven, signInTargets } from "@/lib/auth/finish-sign-in";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const { success, failure } = signInTargets(searchParams.get("next"));
  const code = searchParams.get("code");

  const supabase = await createSupabaseServerClient();
  if (!code || !supabase) return NextResponse.redirect(new URL(failure, origin));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(failure, origin));

  await recordConsentIfGiven(supabase, searchParams.get("consent"));
  return NextResponse.redirect(new URL(success, origin));
}
