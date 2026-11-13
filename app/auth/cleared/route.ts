/**
 * Clears this browser's caches and storage for the site (Clear-Site-Data), then
 * goes to the home page. Used after account deletion so offline copies of
 * personal pages (saved plans, My documents) don't stay on a shared phone.
 */
import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale") === "fil" ? "fil" : "en";
  const res = NextResponse.redirect(new URL(`/${locale}?deleted=1`, request.nextUrl.origin), 303);
  res.headers.set("Clear-Site-Data", '"cache", "storage"');
  return res;
}
