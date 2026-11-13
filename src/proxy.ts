/**
 * Proxy (formerly "middleware" before Next.js 16). Runs before every page request:
 *  1. Locale routing: paths without /en or /fil get redirected to the best
 *     locale (saved cookie first, then Accept-Language).
 *  2. Session refresh: keeps the Supabase auth cookie fresh for signed-in users.
 *
 * Auth route handlers (/auth/*) and API routes are excluded by the matcher;
 * they don't need a locale prefix.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "@/i18n/config";
import { refreshSupabaseSession } from "@/lib/supabase/proxy-session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const firstSegment = pathname.split("/")[1];

  if (!isLocale(firstSegment)) {
    const saved = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(saved) ? saved : negotiateLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    // 307: temporary, so search engines keep indexing the locale-prefixed URLs.
    return NextResponse.redirect(url, 307);
  }

  return refreshSupabaseSession(request, NextResponse.next({ request }));
}

export const config = {
  matcher: [
    // Everything except: Next internals, auth/api handlers, app icons, and files with an extension.
    "/((?!_next/|auth/|api/|icons/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
