"use server";

/**
 * CPA review actions (role 'cpa' only; admins can't approve tax rules).
 *  - cpaReview: marks a verified tax rule/deadline as CPA-reviewed through the
 *    database function cpa_review_tax_item, which checks the role itself.
 *  - cpaApproveProposal: applies a Bantay Batas proposal for a tax rule/deadline.
 *    A published rule is moved to verified, changed (which clears its review),
 *    marked CPA-reviewed, then returned to its status, so the database rule
 *    "published requires CPA review" holds at every step.
 */
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { CONTENT_TAG } from "@/lib/content/public";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { withMessage } from "./paths";
import { schemas } from "./schemas";
import { changedFields } from "./workflow";

async function requireCpa() {
  const user = await getCurrentUserClaims();
  const supabase = await createSupabaseServerClient();
  if (!user || !supabase) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "cpa" ? { user, supabase } : null;
}

const input = z.object({ locale: z.string().refine(isLocale), id: z.guid() });

export async function cpaReview(formData: FormData): Promise<void> {
  const b = input.safeParse({ locale: formData.get("locale"), id: formData.get("id") });
  const table = z.enum(["tax_rules", "tax_deadlines"]).safeParse(formData.get("table"));
  if (!b.success || !table.success) return;
  const page = `/${b.data.locale}/cpa`;
  const ctx = await requireCpa();
  if (!ctx) redirect(withMessage(page, "error", "Only a CPA can review tax rules."));
  const { error } = await ctx.supabase.rpc("cpa_review_tax_item", { p_table: table.data, p_id: b.data.id });
  revalidatePath(page);
  redirect(withMessage(page, error ? "error" : "notice", error ? "Couldn't record the review. The item must be verified first." : "Recorded as CPA-reviewed. An admin can now publish it."));
}

export async function cpaApproveProposal(formData: FormData): Promise<void> {
  const b = input.safeParse({ locale: formData.get("locale"), id: formData.get("id") });
  if (!b.success) return;
  const page = `/${b.data.locale}/cpa`;
  const ctx = await requireCpa();
  if (!ctx) redirect(withMessage(page, "error", "Only a CPA can approve tax changes."));
  const service = createSupabaseServiceClient();
  if (!service) redirect(withMessage(page, "error", "Server key not configured."));

  const { data: p } = await service.from("change_proposals").select("*").eq("id", b.data.id).eq("status", "needs_cpa").maybeSingle();
  if (!p || (p.target_type !== "tax_rule" && p.target_type !== "tax_deadline")) redirect(withMessage(page, "error", "Proposal not found."));
  const table = p.target_type === "tax_rule" ? "tax_rules" : "tax_deadlines";
  const { data: row } = await service.from(table).select("*").eq("id", String(p.target_id)).maybeSingle();
  if (!row) redirect(withMessage(page, "error", "The tax item no longer exists."));

  const fields = (p.proposed_change as { fields: Record<string, { before: unknown; after: unknown }> }).fields;
  const before = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.before]));
  if (changedFields(row, before, Object.keys(fields)).length) redirect(withMessage(page, "error", "The rule changed after this proposal was drafted. Ask an admin to re-check it."));
  const after = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.after]));
  if (!schemas[p.target_type === "tax_rule" ? "tax_rule" : "tax_deadline"].safeParse({ ...row, ...after }).success) redirect(withMessage(page, "error", "The proposed values aren't valid for this rule."));

  const now = new Date().toISOString();
  const originalStatus = String(row.status);
  const steps = [
    { ...after, status: originalStatus === "published" ? "verified" : originalStatus }, // change (clears review)
    { cpa_reviewed: true, reviewed_at: now, reviewed_by: ctx.user.id, last_verified_at: now }, // review
    ...(originalStatus === "published" ? [{ status: "published" }] : []), // back to public
  ];
  for (const patch of steps) {
    const { error } = await service.from(table).update(patch).eq("id", String(p.target_id));
    if (error) redirect(withMessage(page, "error", `Couldn't apply the change (${error.code}).`));
  }
  await service.from("change_proposals").update({ status: "approved", reviewed_at: now, reviewed_by: ctx.user.id, cpa_reviewed_by: ctx.user.id }).eq("id", b.data.id);
  if (p.issuance_id) await service.from("issuances").update({ published: true }).eq("id", String(p.issuance_id));
  revalidatePath(page);
  updateTag(CONTENT_TAG);
  redirect(withMessage(page, "notice", "Tax change applied and marked CPA-reviewed."));
}
