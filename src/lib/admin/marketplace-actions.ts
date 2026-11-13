"use server";

/** Admin marketplace actions: verify listings (after checking the PRC license), moderate reviews, fees. */
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { CONTENT_TAG } from "@/lib/content/public";
import { getAdminContext } from "./data";
import { adminPath, withMessage } from "./paths";

async function admin(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  const ctx = await getAdminContext();
  return isLocale(locale) && typeof ctx !== "string" ? { ctx, page: adminPath(locale, "marketplace") } : null;
}

export async function setListingStatus(formData: FormData): Promise<void> {
  const a = await admin(formData);
  const p = z.object({ userId: z.guid(), status: z.enum(["verified", "rejected", "suspended", "pending"]), note: z.string().trim().max(500).optional() }).safeParse({
    userId: formData.get("userId"), status: formData.get("status"), note: formData.get("note") || undefined,
  });
  if (!a || !p.success) return;
  const verified = p.data.status === "verified";
  const { error } = await a.ctx.supabase.from("cpa_listings").update({ status: p.data.status, admin_note: p.data.note ?? null, verified_at: verified ? new Date().toISOString() : null, verified_by: verified ? a.ctx.userId : null }).eq("user_id", p.data.userId);
  updateTag(CONTENT_TAG);
  revalidatePath(a.page);
  redirect(withMessage(a.page, error ? "error" : "notice", error ? "Couldn't update the listing." : `Listing ${p.data.status}.`));
}

export async function setReviewStatus(formData: FormData): Promise<void> {
  const a = await admin(formData);
  const p = z.object({ requestId: z.guid(), status: z.enum(["published", "hidden"]) }).safeParse({ requestId: formData.get("requestId"), status: formData.get("status") });
  if (!a || !p.success) return;
  await a.ctx.supabase.from("cpa_reviews").update({ status: p.data.status }).eq("request_id", p.data.requestId);
  updateTag(CONTENT_TAG);
  revalidatePath(a.page);
}

export async function setFeeStatus(formData: FormData): Promise<void> {
  const a = await admin(formData);
  const p = z.object({ requestId: z.guid(), status: z.enum(["due", "paid", "waived"]) }).safeParse({ requestId: formData.get("requestId"), status: formData.get("status") });
  if (!a || !p.success) return;
  await a.ctx.supabase.from("platform_fees").update({ status: p.data.status }).eq("request_id", p.data.requestId);
  revalidatePath(a.page);
}

export async function setFeeRate(formData: FormData): Promise<void> {
  const a = await admin(formData);
  const p = z.object({ percent: z.coerce.number().min(0).max(50) }).safeParse({ percent: formData.get("percent") });
  if (!a || !p.success) return;
  await a.ctx.supabase.from("marketplace_settings").update({ fee_rate: Math.round(p.data.percent * 100) / 10000 }).eq("id", true);
  revalidatePath(a.page);
  redirect(withMessage(a.page, "notice", "Fee rate saved. It applies to engagements completed from now on."));
}
