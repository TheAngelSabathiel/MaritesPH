/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Uses the publishable key + the user's session cookies, so every query runs
 * under the user's identity and is filtered by Row Level Security.
 *
 * With Cache Components enabled, anything that calls this reads cookies and
 * must render inside a <Suspense> boundary.
 */
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/env";

export async function createSupabaseServerClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: the proxy refreshes the session on every request.
        }
      },
    },
  });
}

/**
 * Verified identity of the current visitor, or null.
 * getClaims() validates the JWT signature (locally with asymmetric signing
 * keys), unlike getSession(), which trusts the cookie as-is.
 */
export async function getCurrentUserClaims(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email };
}
