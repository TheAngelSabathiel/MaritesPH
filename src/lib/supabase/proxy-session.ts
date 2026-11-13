/**
 * Refreshes the Supabase auth session on each request (called from src/proxy.ts)
 * so Server Components always see a valid, non-expired token.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/env";

export async function refreshSupabaseSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const config = getSupabasePublicConfig();
  if (!config) return response;

  // Only touch Supabase when an auth cookie exists. Anonymous visitors reading
  // guides (most traffic) skip the network round-trip entirely.
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie) return response;

  let current = response;
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        const next = NextResponse.next({ request });
        // Carry over anything the caller already set (e.g. locale cookie, rewrites).
        current.headers.forEach((value, key) => next.headers.set(key, value));
        current.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
        for (const { name, value, options } of cookiesToSet) next.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) next.headers.set(key, value);
        current = next;
      },
    },
  });

  // Do not add logic between client creation and this call (Supabase guidance).
  await supabase.auth.getClaims();
  return current;
}
