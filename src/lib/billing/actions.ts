"use server";

/**
 * Billing Server Actions.
 *  - startCheckout: signed-in only; price comes from subscription_plans (never
 *    the browser); records a pending payment, creates a PayMongo Checkout
 *    Session with our payment id as reference_number, redirects to PayMongo.
 *  - cancelRenewal: stops renewal reminders; access continues until the end.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { myEntitlement } from "./access";
import { createCheckoutSession, paymongoConfig } from "./paymongo";
import { checkoutAllowed, PERIOD_MONTHS, type PlanKey } from "./rules";
import { toCentavos } from "./webhook";

const input = z.object({
  locale: z.string().refine(isLocale),
  plan: z.enum(["freelancer", "negosyo"]),
  months: z.coerce.number().refine((m) => (PERIOD_MONTHS as readonly number[]).includes(m)),
});

export async function startCheckout(formData: FormData): Promise<void> {
  const parsed = input.safeParse({ locale: formData.get("locale"), plan: formData.get("plan"), months: formData.get("months") });
  if (!parsed.success) return;
  const { locale, plan, months } = parsed.data;
  const billing = `/${locale}/account/billing`;
  const user = await getCurrentUserClaims();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/pricing`)}`);

  const cfg = paymongoConfig();
  const service = createSupabaseServiceClient();
  if (!cfg || !service) redirect(`${billing}?checkout=unavailable`);

  const { data: p } = await service.from("subscription_plans").select("key, name, monthly_price_php, active").eq("key", plan).maybeSingle();
  if (!p?.active || p.monthly_price_php == null) redirect(`${billing}?checkout=unavailable`);
  if (!checkoutAllowed(await myEntitlement(user.id), plan as PlanKey, new Date())) redirect(`${billing}?checkout=lower_plan`);

  const amount = Math.round(Number(p.monthly_price_php) * months * 100) / 100;
  const { data: payment, error } = await service
    .from("payments")
    .insert({ user_id: user.id, plan_key: plan, months, amount_php: amount, provider: "paymongo", livemode: cfg.livemode })
    .select("id")
    .single();
  if (error || !payment) redirect(`${billing}?checkout=error`);

  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const session = await createCheckoutSession(cfg, {
    referenceNumber: payment.id,
    name: `${p.name}: ${months} month${months > 1 ? "s" : ""}`,
    description: `${p.name} access for ${months} month${months > 1 ? "s" : ""}. Prepaid, no automatic renewal.`,
    amountCentavos: toCentavos(amount),
    successUrl: `${site}${billing}?checkout=success`,
    cancelUrl: `${site}${billing}?checkout=canceled`,
  });
  if (!session.ok) {
    await service.from("payments").update({ status: "expired", note: `Checkout creation failed (HTTP ${session.status})` }).eq("id", payment.id);
    redirect(`${billing}?checkout=error`);
  }
  await service.from("payments").update({ checkout_session_id: session.sessionId }).eq("id", payment.id);
  redirect(session.checkoutUrl);
}

export async function cancelRenewal(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "en");
  const user = await getCurrentUserClaims();
  if (!user || !isLocale(locale)) return;
  const supabase = await createSupabaseServerClient();
  await supabase?.from("entitlements").update({ status: "canceled" }).eq("user_id", user.id);
  revalidatePath(`/${locale}/account/billing`);
}
