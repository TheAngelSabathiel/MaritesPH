"use server";

/**
 * Planner Server Actions.
 *  - generatePlan: validate input, run the deterministic engines on the cached
 *    published catalog. No AI, no database writes; anyone can use it.
 *  - savePlan: signed-in users only; stores a snapshot (RLS: own rows only).
 *  - myHaveList: documents the signed-in user marked "have" (for prefilling).
 */
import { z } from "zod";
import { cachedNow, getPlannerCatalog } from "@/lib/content/public";
import { buildPlan, STRATEGIES, type PlanResult } from "@/lib/engines/planner";
import { serverEnv } from "@/lib/env.server";
import { runAi } from "@/lib/ai/client";
import { summarizePlanWithAi, type PlanSummary } from "@/lib/ai/plan-summary";
import { whenText } from "@/lib/planner/describe";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { plannerInputSchema, type PlannerFormInput } from "./schema";

export async function generatePlan(raw: unknown): Promise<{ ok: true; result: PlanResult } | { ok: false }> {
  const parsed = plannerInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const [catalog, now] = await Promise.all([getPlannerCatalog(), cachedNow()]);
  const result = buildPlan(catalog, parsed.data, { now: new Date(now), staleDays: serverEnv().CONTENT_STALE_DAYS, waitMinutes: catalog.waitMinutes });
  return { ok: true, result };
}

const saveInput = z.object({
  title: z.string().trim().min(1).max(200),
  input: plannerInputSchema,
  chosen: z.enum(STRATEGIES).nullable(),
});

export async function savePlan(raw: unknown): Promise<{ status: "saved"; id: string } | { status: "signin" | "invalid" | "error" }> {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success) return { status: "invalid" };
  const user = await getCurrentUserClaims();
  if (!user) return { status: "signin" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error" };

  // Recompute on the server: the saved snapshot never comes from the browser.
  const generated = await generatePlan(parsed.data.input);
  if (!generated.ok) return { status: "invalid" };

  const { data, error } = await supabase
    .from("plans")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      goal: parsed.data.input.goal,
      inputs: { ...parsed.data.input, origin: null }, // never store the person's location
      generated_plan: generated.result,
      chosen_option: parsed.data.chosen,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("save plan failed", error?.code);
    return { status: "error" };
  }
  return { status: "saved", id: String(data.id) };
}

export async function myHaveList(): Promise<string[]> {
  const user = await getCurrentUserClaims();
  if (!user) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("user_documents").select("document_id").eq("status", "have");
  return ((data ?? []) as { document_id: string }[]).map((r) => r.document_id);
}

export type { PlannerFormInput };

/**
 * Optional AI summary of the recommended option. The plan is recomputed here
 * (never taken from the browser) and the AI output is validated; on any
 * problem this returns null and the structured plan is shown alone.
 */
export async function summarizePlan(raw: unknown, locale: "en" | "fil"): Promise<PlanSummary | null> {
  const generated = await generatePlan(raw);
  if (!generated.ok || generated.result.status !== "ok") return null;
  const result = generated.result;
  const option = result.options.find((o) => o.key === result.recommended);
  if (!option) return null;
  const [catalog, t, user] = await Promise.all([getPlannerCatalog(), getDictionaryFor(locale === "fil" ? "fil" : "en"), getCurrentUserClaims()]);
  const goalName = result.goalDocumentIds.map((id) => catalog.documents.find((d) => d.id === id)?.name).filter(Boolean).join(" / ");
  return summarizePlanWithAi(runAi, {
    locale,
    goal: goalName,
    strategyLabel: t.planner.strategies[option.key],
    steps: option.steps.map((s) => ({
      id: s.id,
      document: s.documentName,
      office: s.office?.name ?? null,
      when: whenText(t.planner, t.offices.days, s.when),
      prepare: s.prepare.map((p) => p.text),
    })),
    catalogNames: [...catalog.documents.map((d) => d.name), ...catalog.offices.map((o) => o.name)],
    userId: user?.id ?? null,
  });
}
