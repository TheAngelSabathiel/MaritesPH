"use server";

/**
 * Marketplace Server Actions. The database enforces who may do what (RLS and
 * transition triggers); these actions validate input, screen text for contact
 * details, rate-limit requests, release contacts on acceptance (secret key),
 * and send best-effort email notifications (no message content in emails).
 */
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { CONTENT_TAG } from "@/lib/content/public";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/notify/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { screenText, SERVICES } from "./rules";

const loc = z.string().refine(isLocale);
const blank = (v: FormDataEntryValue | null) => (v == null || String(v).trim() === "" ? undefined : String(v).trim());
const site = () => publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

async function session() {
  const user = await getCurrentUserClaims();
  const supabase = await createSupabaseServerClient();
  return user && supabase ? { user, supabase } : null;
}

export async function saveListing(formData: FormData): Promise<void> {
  const p = z.object({
    locale: loc,
    display_name: z.string().trim().min(2).max(100),
    profession: z.enum(["cpa", "bookkeeper"]),
    prc_license_no: z.string().regex(/^[0-9]{4,8}$/).optional(),
    license_valid_until: z.iso.date().optional(),
    firm_name: z.string().trim().max(120).optional(),
    bio: z.string().trim().max(1500).optional(),
    services: z.array(z.enum(SERVICES)).min(1),
    cities: z.string().max(400).optional(),
    online_only: z.boolean(),
    starting_fee_php: z.coerce.number().min(0).max(1_000_000).optional(),
    contact_email: z.email(),
  }).safeParse({
    locale: formData.get("locale"), display_name: formData.get("display_name"), profession: formData.get("profession"),
    prc_license_no: blank(formData.get("prc_license_no")), license_valid_until: blank(formData.get("license_valid_until")),
    firm_name: blank(formData.get("firm_name")), bio: blank(formData.get("bio")), services: formData.getAll("services"),
    cities: blank(formData.get("cities")), online_only: formData.get("online_only") === "on",
    starting_fee_php: blank(formData.get("starting_fee_php")), contact_email: formData.get("contact_email"),
  });
  const locale = String(formData.get("locale") ?? "en");
  if (!p.success) redirect(`/${isLocale(locale) ? locale : "en"}/account/listing?error=invalid`);
  const s = await session();
  if (!s) redirect(`/${p.data.locale}/login`);
  if (p.data.bio && screenText(p.data.bio) !== "ok") redirect(`/${p.data.locale}/account/listing?error=contact`);
  const { locale: l, cities, ...rest } = p.data;
  const row = { ...rest, user_id: s.user.id, cities: (cities ?? "").split(",").map((c) => c.trim()).filter(Boolean).slice(0, 20), prc_license_no: rest.prc_license_no ?? null, license_valid_until: rest.license_valid_until ?? null, firm_name: rest.firm_name ?? null, bio: rest.bio ?? null, starting_fee_php: rest.starting_fee_php ?? null };
  const { data: existing } = await s.supabase.from("cpa_listings").select("user_id").eq("user_id", s.user.id).maybeSingle();
  const { error } = existing ? await s.supabase.from("cpa_listings").update(row).eq("user_id", s.user.id) : await s.supabase.from("cpa_listings").insert(row);
  redirect(`/${l}/account/listing?${error ? "error=save" : "saved=1"}`);
}

export async function requestQuote(formData: FormData): Promise<void> {
  const p = z.object({ locale: loc, cpaUserId: z.guid(), service: z.enum(SERVICES), message: z.string().trim().min(20).max(1500), city: z.string().trim().max(80).optional() }).safeParse({
    locale: formData.get("locale"), cpaUserId: formData.get("cpaUserId"), service: formData.get("service"), message: formData.get("message"), city: blank(formData.get("city")),
  });
  const locale = String(formData.get("locale") ?? "en");
  const back = `/${isLocale(locale) ? locale : "en"}/cpas/${String(formData.get("cpaUserId") ?? "")}`;
  if (!p.success) redirect(`${back}?quote=invalid`);
  const s = await session();
  if (!s) redirect(`/${p.data.locale}/login`);
  if (screenText(p.data.message) !== "ok") redirect(`${back}?quote=contact`);
  if ((await checkRateLimit(`quote:user:${s.user.id}`, 5, 86_400)) === "limited") redirect(`${back}?quote=limited`);
  const { error } = await s.supabase.from("quote_requests").insert({ requester_id: s.user.id, cpa_user_id: p.data.cpaUserId, service: p.data.service, message: p.data.message, city: p.data.city ?? null });
  if (error) redirect(`${back}?quote=error`);
  const service = createSupabaseServiceClient();
  const { data: listing } = service ? await service.from("cpa_listings").select("contact_email").eq("user_id", p.data.cpaUserId).maybeSingle() : { data: null };
  if (listing?.contact_email) await sendEmail(listing.contact_email, "New quote request on Marites PH", `You have a new quote request. Open it here: ${site()}/en/account/quotes`);
  redirect(`/${p.data.locale}/account/quotes?sent=1`);
}

const respondInput = z.object({ locale: loc, id: z.guid(), decision: z.enum(["accepted", "declined"]), reply: z.string().trim().max(1500).optional(), fee: z.coerce.number().min(0).max(10_000_000).optional() });
export async function respondQuote(formData: FormData): Promise<void> {
  const p = respondInput.safeParse({ locale: formData.get("locale"), id: formData.get("id"), decision: formData.get("decision"), reply: blank(formData.get("reply")), fee: blank(formData.get("fee")) });
  const s = await session();
  if (!p.success || !s) return;
  const page = `/${p.data.locale}/account/quotes`;
  if (p.data.reply && screenText(p.data.reply) !== "ok") redirect(`${page}?error=contact`);
  const { data: q, error } = await s.supabase.from("quote_requests").update({ status: p.data.decision, cpa_reply: p.data.reply ?? null, quoted_fee_php: p.data.fee ?? null }).eq("id", p.data.id).eq("cpa_user_id", s.user.id).select("requester_id").single();
  if (error || !q) redirect(`${page}?error=update`);
  const service = createSupabaseServiceClient();
  if (service && q.requester_id) {
    const email = (await service.auth.admin.getUserById(q.requester_id)).data?.user?.email;
    if (email) {
      if (p.data.decision === "accepted") await service.rpc("release_quote_contacts", { p_request_id: p.data.id, p_requester_email: email });
      await sendEmail(email, "Your quote request was answered", `A professional answered your quote request on Marites PH: ${site()}/en/account/quotes`);
    }
  }
  revalidatePath(page);
}

export async function completeQuote(formData: FormData): Promise<void> {
  const p = z.object({ locale: loc, id: z.guid(), fee: z.coerce.number().min(0).max(10_000_000) }).safeParse(Object.fromEntries(formData));
  const s = await session();
  if (!p.success || !s) return;
  await s.supabase.from("quote_requests").update({ status: "completed", final_fee_php: p.data.fee }).eq("id", p.data.id).eq("cpa_user_id", s.user.id);
  revalidatePath(`/${p.data.locale}/account/quotes`);
}

export async function cancelQuote(formData: FormData): Promise<void> {
  const p = z.object({ locale: loc, id: z.guid() }).safeParse(Object.fromEntries(formData));
  const s = await session();
  if (!p.success || !s) return;
  await s.supabase.from("quote_requests").update({ status: "canceled" }).eq("id", p.data.id).eq("requester_id", s.user.id);
  revalidatePath(`/${p.data.locale}/account/quotes`);
}

export async function leaveReview(formData: FormData): Promise<void> {
  const p = z.object({ locale: loc, id: z.guid(), cpaUserId: z.guid(), rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(600).optional() }).safeParse({
    locale: formData.get("locale"), id: formData.get("id"), cpaUserId: formData.get("cpaUserId"), rating: formData.get("rating"), comment: blank(formData.get("comment")),
  });
  const s = await session();
  if (!p.success || !s) return;
  const page = `/${p.data.locale}/account/quotes`;
  if (p.data.comment && screenText(p.data.comment) !== "ok") redirect(`${page}?error=contact`);
  const { error } = await s.supabase.from("cpa_reviews").insert({ request_id: p.data.id, reviewer_id: s.user.id, cpa_user_id: p.data.cpaUserId, rating: p.data.rating, comment: p.data.comment ?? null });
  if (!error) updateTag(CONTENT_TAG);
  revalidatePath(page);
}
