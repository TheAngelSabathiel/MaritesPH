import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { startCheckout } from "@/lib/billing/actions";
import { paymongoConfig } from "@/lib/billing/paymongo";
import { PERIOD_MONTHS } from "@/lib/billing/rules";
import { listPlans } from "@/lib/content/public";
import { formatPeso } from "@/lib/format";
import { pageMetadata } from "@/lib/seo/metadata";
import { Button } from "@/components/ui/button";

export async function generateMetadata(props: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionaryFor(locale);
  return pageMetadata({ locale, path: "/pricing", title: t.billing.pricingTitle, description: t.billing.pricingIntro });
}

/** Plans and prices (from the database). Buying needs sign-in; the action redirects to PayMongo. */
export default async function PricingPage(props: PageProps<"/[locale]/pricing">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const [t, plans] = await Promise.all([getDictionaryFor(locale), listPlans()]);
  const b = t.billing;
  const payable = Boolean(paymongoConfig());
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{b.pricingTitle}</h1>
        <p className="text-lg">{b.pricingIntro}</p>
        <p className="text-sm text-muted-foreground">{b.prepaid}</p>
      </header>
      <ul className="grid gap-4 md:grid-cols-3">
        <li className="space-y-3 rounded-lg border bg-card p-5">
          <h2 className="text-xl font-bold">{b.freeName}</h2>
          <p className="text-2xl font-extrabold">{b.freePrice}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">{b.freeFeatures.map((f) => <li key={f}>{f}</li>)}</ul>
        </li>
        {plans.map((p) => (
          <li key={p.key} className="space-y-3 rounded-lg border-2 border-folder bg-card p-5">
            <h2 className="text-xl font-bold">{p.name}</h2>
            <p className="text-2xl font-extrabold">{b.perMonth.replace("{price}", formatPeso(p.monthly_price_php))}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">{b.planFeatures[p.key].map((f) => <li key={f}>{f}</li>)}</ul>
            {payable ? (
              <form action={startCheckout} className="space-y-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="plan" value={p.key} />
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold">{b.months.replace("{n}", "")}</span>
                  <select name="months" defaultValue="1" className="flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base">
                    {PERIOD_MONTHS.map((m) => <option key={m} value={m}>{b.months.replace("{n}", String(m))}: {formatPeso(p.monthly_price_php * m)}</option>)}
                  </select>
                </label>
                <Button type="submit" className="w-full">{b.buy}</Button>
              </form>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">{b.notAvailable}</p>
            )}
          </li>
        ))}
        {plans.length === 0 ? <li className="rounded-lg border border-dashed p-5 text-muted-foreground md:col-span-2">{b.notAvailable}</li> : null}
      </ul>
      <p className="text-sm text-muted-foreground">{b.disclaimer}</p>
    </div>
  );
}
