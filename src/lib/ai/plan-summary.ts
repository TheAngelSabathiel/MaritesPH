/**
 * Optional AI plan summary: validated so it can only rephrase the plan.
 * Rejected (returns null) if it: is not valid JSON; cites a step id not in the
 * plan; contains digits, currency, or links; or names any document or office
 * that is not part of this plan. On rejection the plain structured plan stands.
 */
import { z } from "zod";
import type { AiRunner } from "./client";
import { extractJson } from "./core";
import { planSummaryPrompt } from "./prompts/plan-summary";

export const planSummarySchema = z.object({
  headline: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(10).max(600),
  referencedStepIds: z.array(z.string()).max(20),
});
export type PlanSummary = z.infer<typeof planSummarySchema>;

export function validatePlanSummary(
  raw: unknown,
  ctx: { stepIds: string[]; planNames: string[]; catalogNames: string[] },
): { ok: true; summary: PlanSummary } | { ok: false; reason: string } {
  const parsed = planSummarySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "shape" };
  const s = parsed.data;
  if (s.referencedStepIds.some((id) => !ctx.stepIds.includes(id))) return { ok: false, reason: "unknown_step" };
  const text = `${s.headline} ${s.summary}`;
  if (/\d/.test(text)) return { ok: false, reason: "numbers" };
  if (/₱|\bphp\b|\bpeso/i.test(text)) return { ok: false, reason: "money" };
  if (/https?:\/\/|www\.|\.(com|ph|org|net)\b/i.test(text)) return { ok: false, reason: "links" };
  const lower = text.toLowerCase();
  const planNames = ctx.planNames.map((n) => n.toLowerCase());
  for (const name of ctx.catalogNames) {
    const n = name.toLowerCase();
    if (lower.includes(n) && !planNames.includes(n)) return { ok: false, reason: "foreign_name" };
  }
  return { ok: true, summary: s };
}

export async function summarizePlanWithAi(
  run: AiRunner,
  input: Parameters<typeof planSummaryPrompt>[0] & { catalogNames: string[]; userId: string | null },
): Promise<PlanSummary | null> {
  const { system, prompt } = planSummaryPrompt(input);
  const res = await run({ purpose: "plan_summary", system, prompt, maxTokens: 600, userId: input.userId });
  if (res.status !== "ok") return null;
  const planNames = input.steps.flatMap((s) => [s.document, ...(s.office ? [s.office] : [])]);
  const v = validatePlanSummary(extractJson(res.text), { stepIds: input.steps.map((s) => s.id), planNames, catalogNames: input.catalogNames });
  if (!v.ok) {
    console.warn("plan summary rejected", v.reason);
    return null;
  }
  return v.summary;
}
