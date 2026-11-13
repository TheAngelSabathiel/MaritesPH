/**
 * Vercel Cron entry for Bantay Batas (see vercel.json). Requires
 * "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends it automatically when
 * CRON_SECRET is set). Runs within ~50 s; unfinished work waits for the next run.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runMonitoring } from "@/lib/monitoring/run";

export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runMonitoring(50_000);
  return NextResponse.json(result, { status: "error" in result ? 503 : 200, headers: { "cache-control": "no-store" } });
}
