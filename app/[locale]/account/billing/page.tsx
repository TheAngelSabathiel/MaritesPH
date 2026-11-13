import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { cancelRenewal } from "@/lib/billing/actions";
import { myEntitlement } from "@/lib/billing/access";
import { daysLeft, hasAccess } from "@/lib/billing/rules";
import { formatPhDate } from "@/lib/content/freshness";
import { formatPeso } from "@/lib/format";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { robots: { index: false, follow: false } };
type Props = PageProps<"/[locale]/account/billing">;

export default async function BillingPage(props: Props) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionaryFor(locale);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.billing.title}</h1>
      <Suspense fallback={<p className="text-muted-foreground">{t.brand.loading}</p>}><Body locale={locale} t={t} searchParams={props.searchParams} /></Suspense>
    </div>
  );
}

const CHECKOUT_KEYS = ["success", "canceled", "unavailable", "error", "lower_plan"] as const;

async function Body({ locale, t, searchParams }: { locale: Locale; t: Messages; searchParams: Props["searchParams"] }) {
  const user = await getCurrentUserClaims();
  if (!user) redirect(`/${locale}/login`);
  const b = t.billing;
  const sp = await searchParams;
  const checkout = CHECKOUT_KEYS.find((k) => k === sp.checkout);
  const supabase = await createSupabaseServerClient();
  const [ent, payments, alerts] = await Promise.all([
    myEntitlement(user.id),
    supabase?.from("payments").select("id, plan_key, months, amount_php, status, created_at, paid_at").order("created_at", { ascending: false }).limit(20),
    supabase?.from("change_alerts").select("id, reason, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const now = new Date();
  const active = hasAccess(ent, "freelancer", now);
  return (
    <>
      {checkout ? <Alert tone={checkout === "success" ? "success" : "caution"}>{b.checkout[checkout]}</Alert> : null}
      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="font-bold">{b.currentPlan}</h2>
        {ent && active ? (
          <>
            <p className="text-lg font-semibold">{ent.plan_key === "negosyo" ? "Marites Negosyo" : "Marites Freelancer"}</p>
            <p>{b.activeUntil.replace("{date}", formatPhDate(ent.current_period_end, locale)).replace("{days}", String(daysLeft(ent, now)))}</p>
            {ent.status === "canceled" ? <p className="text-sm text-muted-foreground">{b.remindersStopped}</p> : (
              <form action={cancelRenewal}><input type="hidden" name="locale" value={locale} /><Button type="submit" size="sm" variant="ghost">{b.stopReminders}</Button></form>
            )}
          </>
        ) : (
          <p>{ent ? b.endedOn.replace("{date}", formatPhDate(ent.current_period_end, locale)) : b.noPlan}</p>
        )}
        <Link href={`/${locale}/pricing`} className={buttonVariants({ size: "sm" })}>{active ? b.renew : b.seePlans}</Link>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">{b.alertsTitle}</h2>
        <p className="text-sm text-muted-foreground">{b.alertsIntro}</p>
        {!active ? <p className="rounded-lg border border-dashed p-4 text-sm">{b.alertsUpsell}</p> : (alerts?.data ?? []).length === 0 ? <p className="text-muted-foreground">{b.alertsEmpty}</p> : (
          <ul className="divide-y rounded-lg border bg-card">
            {(alerts!.data as { id: string; reason: string; created_at: string }[]).map((a) => (
              <li key={a.id} className="p-3"><p>{a.reason}</p><p className="text-xs text-muted-foreground">{formatPhDate(a.created_at, locale)}</p></li>
            ))}
          </ul>
        )}
        <Link href={`/${locale}/ano-ng-bago`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{t.feed.title}</Link>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">{b.history}</h2>
        {(payments?.data ?? []).length === 0 ? <p className="text-muted-foreground">{b.historyEmpty}</p> : (
          <ul className="divide-y rounded-lg border bg-card">
            {(payments!.data as { id: string; plan_key: string; months: number; amount_php: number; status: keyof typeof b.status; created_at: string }[]).map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
                <span>{formatPhDate(p.created_at, locale)} · {p.plan_key === "negosyo" ? "Negosyo" : "Freelancer"} · {b.months.replace("{n}", String(p.months))}</span>
                <span className="font-semibold">{formatPeso(Number(p.amount_php))} · {b.status[p.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-muted-foreground">{b.accountId.replace("{id}", user.id)}</p>
      <p className="text-xs text-muted-foreground">{b.disclaimer}</p>
    </>
  );
}
