"use server";

/**
 * "Report outdated info" Server Action.
 *  - Bots: a hidden honeypot field; if filled, pretend success and drop it.
 *  - Signed-in users: flag inserted with their own session (RLS: user_id = self).
 *  - Anonymous visitors: allowed only when the secret key and RATE_LIMIT_SALT
 *    are configured; inserted with the secret key after rate limiting by
 *    hashed IP. Otherwise they're asked to sign in.
 *  - Everyone: at most REPORT_LIMIT.perWindow reports per hour.
 * Flags land in the admin Flags queue; nothing is published automatically.
 */
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env.server";
import { checkRateLimit, clientIp, hashIp } from "@/lib/rate-limit";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { REPORT_LIMIT, reportSchema, type ReportState } from "./schema";

export async function reportContent(_prev: ReportState, formData: FormData): Promise<ReportState> {
  // Honeypot: real people never see or fill this field.
  if (String(formData.get("website") ?? "").trim() !== "") return { status: "ok" };

  const parsed = reportSchema.safeParse({
    target_type: formData.get("target_type"),
    target_id: formData.get("target_id"),
    reason: formData.get("reason"),
    details: formData.get("details"),
    evidence_url: formData.get("evidence_url") ?? undefined,
  });
  if (!parsed.success) return { status: "invalid" };
  const input = parsed.data;

  const user = await getCurrentUserClaims();
  const env = serverEnv();

  let limitKey: string;
  if (user) {
    limitKey = `flag:user:${user.id}`;
  } else {
    const h = await headers();
    const address = clientIp((name) => h.get(name));
    if (!env.SUPABASE_SECRET_KEY || !env.RATE_LIMIT_SALT || !address) return { status: "signin" };
    limitKey = `flag:ip:${hashIp(address, env.RATE_LIMIT_SALT)}`;
  }

  const limit = await checkRateLimit(limitKey, REPORT_LIMIT.perWindow, REPORT_LIMIT.windowSeconds);
  if (limit === "limited") return { status: "limited" };
  // Anonymous reports require a working limiter; signed-in reports degrade gracefully.
  if (limit === "unavailable" && !user) return { status: "signin" };

  const row = {
    source: "user",
    target_type: input.target_type,
    target_id: input.target_id,
    reason: input.reason,
    details: input.details,
    evidence_url: input.evidence_url ?? null,
  };

  const client = user ? await createSupabaseServerClient() : createSupabaseServiceClient();
  if (!client) return { status: "error" };
  const { error } = await client.from("content_flags").insert(user ? { ...row, user_id: user.id } : { ...row, user_id: null });
  if (error) {
    console.error("report insert failed", error.code);
    return { status: "error" };
  }
  return { status: "ok" };
}
