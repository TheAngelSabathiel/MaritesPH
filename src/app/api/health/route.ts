/**
 * GET /api/health: for uptime monitors. Public response is only {status}.
 * With "Authorization: Bearer <CRON_SECRET>", it adds configuration presence
 * (booleans, never values) and monitoring freshness.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { aiSettings } from "@/lib/ai/config";
import { paymongoConfig } from "@/lib/billing/paymongo";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  const db = createSupabasePublicClient();
  const dbOk = db ? !(await db.from("agencies").select("id", { head: true, count: "exact" })).error : false;
  const status = dbOk ? "ok" : "degraded";
  const headers = { "cache-control": "no-store" };
  if (!authorized(request)) return NextResponse.json({ status }, { status: dbOk ? 200 : 503, headers });

  const service = createSupabaseServiceClient();
  let monitoring: { activeSources: number; failingSources: number; lastSuccessHoursAgo: number | null } | null = null;
  if (service) {
    const { data } = await service.from("official_sources").select("active, failure_count, last_success_at").eq("active", true);
    const rows = (data ?? []) as { failure_count: number; last_success_at: string | null }[];
    const last = rows.map((r) => (r.last_success_at ? Date.parse(r.last_success_at) : 0)).reduce((a, b) => Math.max(a, b), 0);
    monitoring = { activeSources: rows.length, failingSources: rows.filter((r) => r.failure_count >= 3).length, lastSuccessHoursAgo: last ? Math.round((Date.now() - last) / 3_600_000) : null };
  }
  return NextResponse.json(
    {
      status,
      checks: {
        database: dbOk,
        secretKey: Boolean(service),
        ai: aiSettings().enabled,
        payments: Boolean(paymongoConfig()),
        email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
        encryption: Boolean(process.env.FIELD_ENCRYPTION_KEY),
        monitoring,
      },
    },
    { status: dbOk ? 200 : 503, headers },
  );
}
