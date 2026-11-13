import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { formatPhDate } from "@/lib/content/freshness";
import { listGuides, listTaxRules } from "@/lib/content/public";
import { filingCalendar } from "@/lib/engines/tax";
import { freelancerAccess } from "@/lib/freelancer/access";
import { DEFAULT_PROFILE, getMyProfile } from "@/lib/freelancer/data";
import { pickYear } from "@/lib/freelancer/year";
import { Alert } from "@/components/ui/alert";
import { SignInPrompt, UpgradePrompt } from "@/components/freelancer/require";

export const metadata: Metadata = { robots: { index: false, follow: false } };
type Props = PageProps<"/[locale]/freelancer/calendar">;

export default async function CalendarPage(props: Props) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionaryFor(locale);
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">{t.freelancer.calendar.title}</h1>
      <p className="text-muted-foreground">{t.freelancer.calendar.intro}</p>
      <Suspense fallback={<p className="text-muted-foreground">{t.brand.loading}</p>}><Body locale={locale} t={t} searchParams={props.searchParams} /></Suspense>
    </>
  );
}

async function Body({ locale, t, searchParams }: { locale: Locale; t: Messages; searchParams: Props["searchParams"] }) {
  const access = await freelancerAccess();
  if (access.status === "signin") return <SignInPrompt text={t.freelancer.signIn} href={`/${locale}/login`} label={t.nav.signIn} />;
  if (access.status === "upgrade") return <UpgradePrompt text={t.billing.upgradeFreelancer} href={`/${locale}/pricing`} label={t.billing.seePlans} />;
  const year = pickYear((await searchParams).year, new Date());
  const [{ deadlines }, profile, guides] = await Promise.all([listTaxRules(), getMyProfile(access.userId), listGuides("business")]);
  const p = profile ?? DEFAULT_PROFILE;
  const items = filingCalendar(deadlines, year, p.tax_option);
  const c = t.freelancer.calendar;
  // Walkthroughs: published business guides whose name mentions the form (e.g. "1701Q").
  const walkthrough = (form: string) => guides.find((g) => g.name.toUpperCase().includes(form.toUpperCase()));
  return (
    <>
      <p className="text-sm">
        {p.email_reminders ? c.remindersOn.replace("{days}", String(p.reminder_days_before)) : c.remindersOff}{" "}
        <Link href={`/${locale}/freelancer/profile`} className="font-semibold text-primary underline">{c.changeReminders}</Link>
      </p>
      {items.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-muted-foreground">{c.empty}</p> : (
        <ol className="space-y-2">
          {items.map((d) => {
            const w = walkthrough(d.formCode);
            return (
              <li key={d.key} className="rounded-lg border bg-card p-4">
                <p className="font-bold">BIR {d.formCode} · {d.period}</p>
                <p>{c.due.replace("{date}", formatPhDate(d.dueOn, locale))}{d.movedFromWeekend ? <span className="text-sm text-muted-foreground"> ({c.moved})</span> : null}</p>
                {d.description ? <p className="text-sm text-muted-foreground">{d.description}</p> : null}
                {!d.cpaReviewed ? <p className="text-sm font-semibold text-caution">{t.freelancer.tax.notCpaReviewed}</p> : null}
                {w ? <Link href={`/${locale}/business/${w.slug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{c.walkthrough}</Link> : null}
              </li>
            );
          })}
        </ol>
      )}
      <Alert tone="info">{c.holidaysNote}</Alert>
    </>
  );
}
