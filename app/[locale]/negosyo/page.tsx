import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { requirePlan } from "@/lib/billing/access";
import { listRenewalCities } from "@/lib/content/public";
import { createBusiness } from "@/lib/negosyo/actions";
import { listBusinesses } from "@/lib/negosyo/data";
import { pageMetadata } from "@/lib/seo/metadata";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignInPrompt, UpgradePrompt } from "@/components/freelancer/require";

export async function generateMetadata(props: PageProps<"/[locale]/negosyo">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionaryFor(locale);
  return pageMetadata({ locale, path: "/negosyo", title: t.negosyo.title, description: t.negosyo.intro });
}

export default async function NegosyoHub(props: PageProps<"/[locale]/negosyo">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionaryFor(locale);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.negosyo.title}</h1>
        <p className="text-lg">{t.negosyo.intro}</p>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">{t.brand.loading}</p>}><Body locale={locale} t={t} searchParams={props.searchParams} /></Suspense>
      <Alert tone="info">{t.negosyo.disclaimer}</Alert>
    </div>
  );
}

async function Body({ locale, t, searchParams }: { locale: string; t: Messages; searchParams: PageProps<"/[locale]/negosyo">["searchParams"] }) {
  const access = await requirePlan("negosyo");
  const n = t.negosyo;
  if (access.status === "signin") return <SignInPrompt text={n.signIn} href={`/${locale}/login`} label={t.nav.signIn} />;
  if (access.status === "upgrade") return <UpgradePrompt text={n.upgrade} href={`/${locale}/pricing`} label={t.billing.seePlans} />;
  const [businesses, cities, sp] = await Promise.all([listBusinesses(), listRenewalCities(), searchParams]);
  return (
    <>
      {sp.error === "limit" ? <Alert tone="caution">{n.limit}</Alert> : null}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">{n.businesses}</h2>
        {businesses.length === 0 ? <p className="text-muted-foreground">{n.none}</p> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {businesses.map((b) => (
              <li key={b.id}><Link href={`/${locale}/negosyo/${b.id}`} className="block rounded-lg border bg-card p-4 active:bg-muted"><span className="block font-bold text-primary">{b.name}</span><span className="text-sm text-muted-foreground">{b.city ?? ""}</span></Link></li>
            ))}
          </ul>
        )}
      </section>
      <form action={createBusiness} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <input type="hidden" name="locale" value={locale} />
        <h2 className="font-bold sm:col-span-2">{n.add}</h2>
        <label className="space-y-1 text-sm"><span className="font-semibold">{n.name}</span><Input name="name" required minLength={2} maxLength={120} /></label>
        <label className="space-y-1 text-sm"><span className="font-semibold">{n.city}</span><Input name="city" list="renewal-cities" maxLength={80} /></label>
        <datalist id="renewal-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
        <Button type="submit" className="sm:w-auto">{n.create}</Button>
      </form>
    </>
  );
}
