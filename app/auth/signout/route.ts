/** Sign out (POST only, same-origin only). */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { localeFromPath } from "@/lib/auth/finish-sign-in";

export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  // Basic CSRF protection: browsers always send Origin on cross-site POSTs.
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();

  const form = await request.formData().catch(() => null);
  const localePath = String(form?.get("locale") ?? "");
  const locale = localeFromPath(`/${localePath}`);
  // 303 so the browser follows with GET. Clear-Site-Data removes offline copies of
  // personal pages (saved plans, My documents) from this device.
  const res = NextResponse.redirect(new URL(`/${locale}`, origin), 303);
  res.headers.set("Clear-Site-Data", '"cache", "storage"');
  return res;
}
