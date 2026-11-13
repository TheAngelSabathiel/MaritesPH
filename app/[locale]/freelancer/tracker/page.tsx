import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { deleteEntry } from "@/lib/freelancer/actions";
import { freelancerAccess } from "@/lib/freelancer/access";
import { listEntries, quarterTotals, type Entry } from "@/lib/freelancer/data";
import { pickYear } from "@/lib/freelancer/year";
import { formatPeso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EntryForm } from "@/components/freelancer/entry-form";
import { SignInPrompt, UpgradePrompt } from "@/components/freelancer/require";

export const metadata: Metadata = { robots: { index: false, follow: false } };
type Props = PageProps<"/[locale]/freelancer/tracker">;

export default async function TrackerPage(props: Props) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionaryFor(locale);
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">{t.freelancer.tracker.title}</h1>
      <Suspense fallback={<p className="text-muted-foreground">{t.brand.loading}</p>}><Body locale={locale} t={t} searchParams={props.searchParams} /></Suspense>
    </>
  );
}

async function Body({ locale, t, searchParams }: { locale: string; t: Messages; searchParams: Props["searchParams"] }) {
  const access = await freelancerAccess();
  if (access.status === "signin") return <SignInPrompt text={t.freelancer.signIn} href={`/${locale}/login`} label={t.nav.signIn} />;
  if (access.status === "upgrade") return <UpgradePrompt text={t.billing.upgradeFreelancer} href={`/${locale}/pricing`} label={t.billing.seePlans} />;
  const year = pickYear((await searchParams).year, new Date());
  const [income, expenses] = await Promise.all([listEntries("income", year), listEntries("expense", year)]);
  const tt = t.freelancer.tracker;
  const qi = quarterTotals(income);
  const qe = quarterTotals(expenses);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);


  return (
    <>
      <p className="text-sm font-semibold">{t.freelancer.year}: {year}</p>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">{tt.totalsHeading}</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted"><tr><th className="p-2" />{[1, 2, 3, 4].map((n) => <th key={n} className="p-2">{tt.quarter.replace("{n}", String(n))}</th>)}<th className="p-2">{tt.total}</th></tr></thead>
            <tbody>
              <tr className="border-t"><th className="p-2 text-left">{tt.income}</th>{qi.map((v, i) => <td key={i} className="p-2">{formatPeso(v)}</td>)}<td className="p-2 font-bold">{formatPeso(sum(qi))}</td></tr>
              <tr className="border-t"><th className="p-2 text-left">{tt.expenses}</th>{qe.map((v, i) => <td key={i} className="p-2">{formatPeso(v)}</td>)}<td className="p-2 font-bold">{formatPeso(sum(qe))}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <EntryList kind="income" rows={income} locale={locale} t={t} />
      <EntryList kind="expense" rows={expenses} locale={locale} t={t} />
    </>
  );
}

function EntryList({ kind, rows, locale, t }: { kind: "income" | "expense"; rows: Entry[]; locale: string; t: Messages }) {
  const tt = t.freelancer.tracker;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{kind === "income" ? tt.income : tt.expenses}</h2>
      <EntryForm kind={kind} locale={locale} t={tt} saved={t.freelancer.saved} error={t.freelancer.error} partial={t.freelancer.encryptionUnavailable} />
      {rows.length === 0 ? <p className="text-muted-foreground">{tt.empty}</p> : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                <span className="font-semibold">{formatPeso(e.php_amount)}</span>
                <span className="text-sm text-muted-foreground"> · {e.date} · {(kind === "income" ? tt.incomeCategories : tt.expenseCategories)[e.category as never] ?? e.category}</span>
                {e.currency !== "PHP" ? <span className="block text-xs text-muted-foreground">{e.amount} {e.currency} × {e.fx_rate}</span> : null}
                {e.notes ? <span className="block break-words text-sm">{e.notes}</span> : null}
              </span>
              <form action={deleteEntry}>
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={e.id} />
                <Button type="submit" size="sm" variant="ghost" className="text-destructive">{tt.delete}</Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
