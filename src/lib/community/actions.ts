"use server";

/**
 * Community Server Actions.
 *  - askChika: Chika sa Pila troubleshooter. Rate-limited (5/hour per account
 *    or hashed IP). Cached answers are reused even when AI is off.
 *  - submitTip: signed-in users only, 5 per day. Clear fixer patterns are refused
 *    (never stored); everything else waits for admin approval.
 */
import { headers } from "next/headers";
import { z } from "zod";
import { runAi } from "@/lib/ai/client";
import { aiSettings } from "@/lib/ai/config";
import { getPlannerCatalog } from "@/lib/content/public";
import { troubleshoot, storedResultSchema, type TroubleshootOutcome } from "@/lib/engines/troubleshoot";
import { serverEnv } from "@/lib/env.server";
import { checkRateLimit, clientIp, hashIp } from "@/lib/rate-limit";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { moderateTip } from "./moderation";

async function limitKey(prefix: string): Promise<string | null> {
  const user = await getCurrentUserClaims();
  if (user) return `${prefix}:user:${user.id}`;
  const salt = serverEnv().RATE_LIMIT_SALT;
  const h = await headers();
  const ip = clientIp((n) => h.get(n));
  return salt && ip ? `${prefix}:ip:${hashIp(ip, salt)}` : null;
}

const askSchema = z.object({
  documentId: z.guid(),
  problem: z.string().trim().min(10).max(500),
  locale: z.enum(["en", "fil"]),
});

export type ChikaState = { status: "idle" | "limited" | "signin" | "invalid_input" } | TroubleshootOutcome;

export async function askChika(_prev: ChikaState, formData: FormData): Promise<ChikaState> {
  const parsed = askSchema.safeParse({ documentId: formData.get("documentId"), problem: formData.get("problem"), locale: formData.get("locale") });
  if (!parsed.success) return { status: "invalid_input" };
  const { documentId, problem, locale } = parsed.data;

  const catalog = await getPlannerCatalog();
  const doc = catalog.documents.find((d) => d.id === documentId);
  if (!doc) return { status: "invalid_input" }; // only published documents

  const key = await limitKey("chika");
  if (!key) return { status: "signin" };
  const limit = await checkRateLimit(key, 5, 3600);
  if (limit === "limited") return { status: "limited" };

  const user = await getCurrentUserClaims();
  const service = createSupabaseServiceClient();
  return troubleshoot(
    { documentId, documentName: doc.name, agencyName: doc.agencyName, problem, locale, userId: user?.id ?? null },
    {
      run: runAi,
      domains: aiSettings().communityDomains,
      now: () => new Date(),
      findCached: async (docId, text, loc) => {
        if (!service) return null;
        const { data } = await service.rpc("find_similar_troubleshoot", { p_document_id: docId, p_problem: text, p_locale: loc });
        const row = (data as { result: unknown }[] | null)?.[0];
        const r = row ? storedResultSchema.safeParse(row.result) : null;
        return r?.success ? r.data : null;
      },
      store: async (row) => {
        if (!service) return;
        const { error } = await service.from("troubleshoot_queries").insert({
          user_id: user?.id ?? null,
          document_id: row.documentId,
          problem_text: row.problem,
          locale: row.locale,
          result: row.result,
        });
        if (error) console.error("store troubleshoot failed", error.code);
      },
    },
  );
}

const tipSchema = z
  .object({
    officeId: z.guid().optional(),
    documentId: z.guid().optional(),
    body: z.string().trim().min(10).max(500),
    waitMinutes: z.coerce.number().int().min(0).max(720).optional(),
    visitedOn: z.iso.date().optional(),
    extra: z.string().trim().max(300).optional(),
  })
  .refine((t) => t.officeId || t.documentId);

export type TipState = { status: "idle" | "sent" | "blocked" | "signin" | "limited" | "invalid" | "error" };

const blank = (v: FormDataEntryValue | null) => (v == null || String(v).trim() === "" ? undefined : String(v));

export async function submitTip(_prev: TipState, formData: FormData): Promise<TipState> {
  const parsed = tipSchema.safeParse({
    officeId: blank(formData.get("officeId")),
    documentId: blank(formData.get("documentId")),
    body: formData.get("body"),
    waitMinutes: blank(formData.get("waitMinutes")),
    visitedOn: blank(formData.get("visitedOn")),
    extra: blank(formData.get("extra")),
  });
  if (!parsed.success) return { status: "invalid" };
  const user = await getCurrentUserClaims();
  if (!user) return { status: "signin" };

  const moderation = moderateTip(`${parsed.data.body} ${parsed.data.extra ?? ""}`);
  if (moderation.autoReject) return { status: "blocked" }; // fixer pattern: never stored

  const limit = await checkRateLimit(`tip:user:${user.id}`, 5, 86_400);
  if (limit === "limited") return { status: "limited" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error" };
  const { error } = await supabase.from("tips").insert({
    user_id: user.id,
    office_id: parsed.data.officeId ?? null,
    document_id: parsed.data.documentId ?? null,
    body: parsed.data.body,
    wait_minutes: parsed.data.waitMinutes ?? null,
    visited_on: parsed.data.visitedOn ?? null,
    extra_requirements_asked: parsed.data.extra ?? null,
    auto_flags: moderation.flags,
  });
  if (error) {
    console.error("tip insert failed", error.code);
    return { status: "error" };
  }
  return { status: "sent" };
}
