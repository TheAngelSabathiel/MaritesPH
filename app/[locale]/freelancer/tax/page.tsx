import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { listTaxRules } from "@/lib/content/public";
import { freelancerAccess } from "@/lib/freelancer/access";
import { DEFAULT_PROFILE, getMyProfile, listEntries, quarterTotals } from "@/lib/freelancer/data";
import { pickYear } from "@/lib/freelancer/year";
import { SignInPrompt, UpgradePrompt } from "@/components/freelancer/require";
import { TaxCalculator } from "@/components/freelancer/tax-calculator";

export const metadata: Metadata = { robots: { index: false, follow: false } };
type Props = PageProps<"/[locale]/freelancer/tax">;

export default async function TaxPage(props: Props) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionaryFor(locale);
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">{t.freelancer.tax.title}</h1>
      <p className="text-muted-foreground">{t.freelancer.tax.intro}</p>
      <Suspense fallback={<p className="text-muted-foreground">{t.brand.loading}</p>}><Body locale={locale} t={t} searchParams={props.searchParams} /></Suspense>
    </>
  );
}

async function Body({ locale, t, searchParams }: { locale: string; t: Messages; searchParams: Props["searchParams"] }) {
  const access = await freelancerAccess();
  if (access.status === "signin") return <SignInPrompt text={t.freelancer.signIn} href={`/${locale}/login`} label={t.nav.signIn} />;
  if (access.status === "upgrade") return <UpgradePrompt text={t.billing.upgradeFreelancer} href={`/${locale}/pricing`} label={t.billing.seePlans} />;
  const year = pickYear((await searchParams).year, new Date());
  const [{ rules }, profile, income, expenses] = await Promise.all([listTaxRules(), getMyProfile(access.userId), listEntries("income", year), listEntries("expense", year)]);
  const p = profile ?? DEFAULT_PROFILE;
  const qi = quarterTotals(income);
  const qe = quarterTotals(expenses);
  return (
    <>
      <p className="text-sm font-semibold">{t.freelancer.year}: {year}</p>
      <TaxCalculator
        rules={rules}
        year={year}
        option={p.tax_option}
        initial={{ gross: qi.reduce((a, b) => a + b, 0), expenses: qe.reduce((a, b) => a + b, 0), deduction: p.deduction_method, vat: p.vat_status === "vat", quarters: qi.map((g, i) => ({ gross: g, expenses: qe[i] })) }}
        t={t.freelancer.tax}
        freelancerT={t.freelancer}
      />
    </>
  );
}
