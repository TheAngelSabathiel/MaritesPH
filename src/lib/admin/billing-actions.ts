"use server";

/**
 * Admin billing actions: set plan prices/activation, grant complimentary access.
 * Comps go through apply_payment() like real payments (a manual ₱0 payment row),
 * so period rules and the audit trail are the same.
 */
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { CONTENT_TAG } from "@/lib/content/public";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "./data";
import { adminPath, withMessage } from "./paths";

export async function updatePlan(formData: FormData): Promise<void> {
  const p = z.object({
    locale: z.string().refine(isLocale),
    key: z.enum(["freelancer", "negosyo"]),
    price: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().positive().max(100_000).nullable()),
    active: z.boolean(),
  }).safeParse({ locale: formData.get("locale"), key: formData.get("key"), price: formData.get("price"), active: formData.get("active") === "on" });
  const ctx = await getAdminContext();
  if (!p.success || typeof ctx === "string") return;
  const page = adminPath(p.data.locale, "billing");
  const { error } = await ctx.supabase.from("subscription_plans").update({ monthly_price_php: p.data.price, active: p.data.active }).eq("key", p.data.key);
  updateTag(CONTENT_TAG);
  revalidatePath(page);
  redirect(withMessage(page, error ? "error" : "notice", error ? "A plan needs a price before it can be active." : "Plan saved."));
}

export async function grantComp(formData: FormData): Promise<void> {
  const p = z.object({
    locale: z.string().refine(isLocale),
    userId: z.guid(),
    plan: z.enum(["freelancer", "negosyo"]),
    months: z.coerce.number().refine((m) => [1, 3, 6, 12].includes(m)),
    note: z.string().trim().min(3).max(300),
  }).safeParse(Object.fromEntries(formData));
  const ctx = await getAdminContext();
  if (!p.success || typeof ctx === "string") return;
  const page = adminPath(p.data.locale, "billing");
  const service = createSupabaseServiceClient();
  if (!service) redirect(withMessage(page, "error", "Server key not configured."));
  const { data: pay, error } = await service.from("payments").insert({ user_id: p.data.userId, plan_key: p.data.plan, months: p.data.months, amount_php: 0, provider: "manual", note: `Comp by admin: ${p.data.note}` }).select("id").single();
  if (error || !pay) redirect(withMessage(page, "error", "Couldn't create the grant (check the account ID)."));
  const { data: outcome } = await service.rpc("apply_payment", { p_payment_id: pay.id, p_status: "comp" });
  revalidatePath(page);
  redirect(withMessage(page, outcome === "applied" ? "notice" : "error", outcome === "applied" ? "Complimentary access granted." : `Not applied: ${String(outcome)}.`));
}
