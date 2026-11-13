import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { formatPhDate } from "@/lib/content/freshness";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata(props: PageProps<"/[locale]/plans">): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getDictionaryFor(isLocale(locale) ? locale : "en");
  return { title: t.planner.plansTitle, robots: { index: false, follow: false } };
}

export default async function PlansPage(props: PageProps<"/[locale]/plans">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionaryFor(locale);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.planner.plansTitle}</h1>
      <Suspense fallback={<p className="text-muted-foreground">{t.brand.loading}</p>}>
        <List locale={locale} t={t} />
      </Suspense>
      <Link href={`/${locale}/lakad`} className={buttonVariants()}>
        {t.planner.makeMyOwn}
      </Link>
    </div>
  );
}

async function List({ locale, t }: { locale: Locale; t: Messages }) {
  const user = await getCurrentUserClaims();
  if (!user) redirect(`/${locale}/login`);
  const supabase = await createSupabaseServerClient();
  const { data } = supabase ? await supabase.from("plans").select("id, title, created_at").order("created_at", { ascending: false }) : { data: [] };
  const plans = (data ?? []) as { id: string; title: string; created_at: string }[];
  if (plans.length === 0) return <p className="rounded-lg border border-dashed p-6 font-semibold text-muted-foreground">{t.planner.plansEmpty}</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {plans.map((p) => (
        <li key={p.id}>
          <Link href={`/${locale}/plans/${p.id}`} className="flex min-h-11 flex-col px-4 py-3 active:bg-muted">
            <span className="font-bold text-primary">{p.title}</span>
            <span className="text-sm text-muted-foreground">{t.planner.savedOn.replace("{date}", formatPhDate(p.created_at, locale))}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
