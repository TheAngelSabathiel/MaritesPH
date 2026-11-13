import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { requirePlan } from "@/lib/billing/access";
import { formatPhDate } from "@/lib/content/freshness";
import { getRenewalProcess, listRenewalCities, listTaxRules } from "@/lib/content/public";
import { computeContributions, type Agency } from "@/lib/engines/contributions";
import { renewalPlan } from "@/lib/engines/lgu";
import { remittanceCalendar } from "@/lib/engines/tax";
import { formatPeso } from "@/lib/format";
import { addEmployee, deleteBusiness, markPermitRenewed, recordRemittance, setEmployeeActive, updateBusiness } from "@/lib/negosyo/actions";
import { getBusiness, listEmployees, listRemittances, previousPeriod } from "@/lib/negosyo/data";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignInPrompt, UpgradePrompt } from "@/components/freelancer/require";

export const metadata: Metadata = { robots: { index: false, follow: false } };
type Props = PageProps<"/[locale]/negosyo/[id]">;
const field = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base";
const AGENCIES: Agency[] = ["sss", "philhealth", "pagibig"];
const FORM_OF: Record<Agency, string> = { sss: "SSS", philhealth: "PhilHealth", pagibig: "Pag-IBIG" };

/** Request-time route ([id]): everything renders inside Suspense (as in /plans/[id]). */
export default function BusinessPage(props: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={null}>
        <Shell params={props.params} />
      </Suspense>
    </div>
  );
}

async function Shell({ params }: { params: Props["params"] }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionaryFor(locale);
  return (
    <>
      <Link href={`/${locale}/negosyo`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{t.negosyo.businesses}</Link>
      <Body locale={locale} t={t} params={params} />
      <Alert tone="info">{t.negosyo.disclaimer}</Alert>
    </>
  );
}

async function Body({ locale, t, params }: { locale: Locale; t: Messages; params: Props["params"] }) {
  const n = t.negosyo;
  const access = await requirePlan("negosyo");
  if (access.status === "signin") return <SignInPrompt text={n.signIn} href={`/${locale}/login`} label={t.nav.signIn} />;
  if (access.status === "upgrade") return <UpgradePrompt text={n.upgrade} href={`/${locale}/pricing`} label={t.billing.seePlans} />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const b = await getBusiness(id);
  if (!b) notFound();
  const now = new Date();
  const today = new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
  const period = previousPeriod(now);
  const [employees, remittances, { rules, deadlines }, process, cities] = await Promise.all([listEmployees(b.id), listRemittances(b.id), listTaxRules(), b.city ? getRenewalProcess(b.city) : Promise.resolve(null), listRenewalCities()]);
  const active = employees.filter((e) => e.active);

  // Contributions this month, summed per agency over active employees.
  const sums = Object.fromEntries(AGENCIES.map((a) => [a, { employee: 0, employer: 0 }])) as Record<Agency, { employee: number; employer: number }>;
  let rulesMissing = false;
  for (const e of active) {
    const r = computeContributions(e.monthly_salary, today, rules);
    if (r.status !== "ok") { rulesMissing = true; break; }
    for (const l of r.lines) { sums[l.agency].employee += l.employee; sums[l.agency].employer += l.employer; }
  }
  const cal = remittanceCalendar(deadlines, period, { sss: b.sss_due_digit, philhealth: b.philhealth_due_digit });
  const plan = process ? renewalPlan(process, b.permit_renewed_for, today) : null;
  const H = (s: string) => <h2 className="text-xl font-bold">{s}</h2>;

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">{b.name}</h1>

      <section className="space-y-3">
        {H(n.permitHeading)}
        {!b.city ? <p className="text-muted-foreground">{n.noCity}</p> : !process || !plan ? <p className="text-muted-foreground">{n.noProcess.replace("{city}", b.city)}</p> : (
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <p className="font-bold">{process.title}</p>
            {plan.nextDeadline ? <p className={plan.nextDeadline.daysLeft <= 30 ? "font-semibold text-caution" : ""}>{n.nextDeadline.replace("{label}", plan.nextDeadline.label).replace("{date}", formatPhDate(plan.nextDeadline.date, locale)).replace("{days}", String(plan.nextDeadline.daysLeft))}</p> : null}
            {plan.renewedAlready ? <p className="text-sm text-stamp">{n.renewedFor.replace("{year}", String(b.permit_renewed_for))}</p> : (
              <form action={markPermitRenewed}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="businessId" value={b.id} /><input type="hidden" name="year" value={plan.year} /><Button type="submit" size="sm" variant="outline">{n.markRenewed.replace("{year}", String(plan.year))}</Button></form>
            )}
            <details><summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">{n.checklist}</summary>
              <ul className="list-disc space-y-1 pl-5">{process.requirements.map((r) => <li key={r.text}>{r.text}{r.note ? <span className="text-muted-foreground"> ({r.note})</span> : null}</li>)}</ul>
            </details>
            <details><summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">{n.steps}</summary>
              <ol className="list-decimal space-y-1 pl-5">{process.steps.map((s) => <li key={s.title}><span className="font-semibold">{s.title}</span>{s.body ? <span className="block text-sm">{s.body}</span> : null}</li>)}</ol>
            </details>
            <details><summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">{n.fees}</summary>
              <ul className="space-y-1">{process.fees.map((f) => <li key={f.label} className="flex justify-between gap-3 text-sm"><span>{f.label}{f.note ? <span className="block text-muted-foreground">{f.note}</span> : null}</span><span className="font-semibold">{f.amount == null ? n.feeDepends : formatPeso(f.amount)}</span></li>)}</ul>
            </details>
            <p className="text-xs text-muted-foreground">
              {process.last_verified_at ? n.lastVerified.replace("{date}", formatPhDate(process.last_verified_at, locale)) : ""}
              {process.source_url ? <> · <a href={process.source_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{n.source}</a></> : null}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        {H(n.contributionsHeading)}
        {rulesMissing ? <Alert tone="caution">{n.noRules}</Alert> : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted"><tr><th className="p-2" /><th className="p-2">{n.employeeShare}</th><th className="p-2">{n.employerShare}</th><th className="p-2">{n.total}</th></tr></thead>
              <tbody>{AGENCIES.map((a) => <tr key={a} className="border-t"><th className="p-2 text-left">{n.agency[a]}</th><td className="p-2">{formatPeso(sums[a].employee)}</td><td className="p-2">{formatPeso(sums[a].employer)}</td><td className="p-2 font-semibold">{formatPeso(sums[a].employee + sums[a].employer)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        {H(n.remitHeading.replace("{period}", period))}
        <ul className="divide-y rounded-lg border bg-card">
          {AGENCIES.map((a) => {
            const d = cal.find((x) => x.formCode === FORM_OF[a]);
            const paid = remittances.find((r) => r.agency === a && r.period === period);
            return (
              <li key={a} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span><span className="font-semibold">{n.agency[a]}</span> <span className="text-sm text-muted-foreground">{d ? (d.dueOn ? n.due.replace("{date}", formatPhDate(d.dueOn, locale)) : n.dueNeedsDigit) : ""}</span></span>
                {paid ? <span className="text-sm text-stamp">{n.remitted.replace("{date}", formatPhDate(paid.paid_on, locale))}</span> : active.length && !rulesMissing ? (
                  <form action={recordRemittance}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="businessId" value={b.id} /><input type="hidden" name="agency" value={a} /><input type="hidden" name="period" value={period} /><input type="hidden" name="paidOn" value={today} /><Button type="submit" size="sm" variant="outline">{n.markPaid}</Button></form>
                ) : <span className="text-sm text-muted-foreground">{n.notPaid}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        {H(n.employeesHeading)}
        {employees.length === 0 ? <p className="text-muted-foreground">{n.noEmployees}</p> : (
          <ul className="divide-y rounded-lg border bg-card">
            {employees.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className={e.active ? "" : "text-muted-foreground"}><span className="font-semibold">{e.name}</span> · {formatPeso(e.monthly_salary)}{e.active ? "" : ` · ${n.inactive}`}</span>
                <form action={setEmployeeActive}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="businessId" value={b.id} /><input type="hidden" name="id" value={e.id} /><input type="hidden" name="active" value={e.active ? "false" : "true"} /><Button type="submit" size="sm" variant="ghost">{e.active ? n.deactivate : n.activate}</Button></form>
              </li>
            ))}
          </ul>
        )}
        <form action={addEmployee} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="businessId" value={b.id} />
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.employeeName}</span><Input name="name" required minLength={2} maxLength={120} autoComplete="off" /></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.salary}</span><Input name="salary" inputMode="decimal" required /></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.startDate}</span><Input name="start" type="date" /></label>
          <Button type="submit" className="sm:w-auto">{n.addEmployee}</Button>
        </form>
      </section>

      <section className="space-y-3">
        {H(n.detailsHeading)}
        <form action={updateBusiness} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={b.id} />
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.name}</span><Input name="name" defaultValue={b.name} required /></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.city}</span><Input name="city" defaultValue={b.city ?? ""} list="renewal-cities-b" /></label>
          <datalist id="renewal-cities-b">{cities.map((c) => <option key={c} value={c} />)}</datalist>
          <label className="space-y-1 text-sm sm:col-span-2"><span className="font-semibold">{n.type}</span><select name="business_type" defaultValue={b.business_type} className={field}>{Object.entries(n.types).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <p className="font-semibold sm:col-span-2">{n.privateNumbers}</p>
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.registrationNo}</span><Input name="registrationNo" defaultValue={b.registrationNo ?? ""} autoComplete="off" /></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.sssNo}</span><Input name="sssNo" defaultValue={b.sssNo ?? ""} autoComplete="off" /></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.philhealthNo}</span><Input name="philhealthNo" defaultValue={b.philhealthNo ?? ""} autoComplete="off" /></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.pagibigNo}</span><Input name="pagibigNo" defaultValue={b.pagibigNo ?? ""} autoComplete="off" /></label>
          <p className="text-sm text-muted-foreground sm:col-span-2">{n.digitsHint}</p>
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.sssDigit}</span><Input name="sss_due_digit" inputMode="numeric" maxLength={1} defaultValue={b.sss_due_digit ?? ""} /></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">{n.philhealthDigit}</span><Input name="philhealth_due_digit" inputMode="numeric" maxLength={1} defaultValue={b.philhealth_due_digit ?? ""} /></label>
          <Button type="submit" className="sm:col-span-2 sm:w-auto">{n.save}</Button>
        </form>
      </section>

      <details className="rounded-lg border border-destructive/40 bg-card">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold text-destructive">{n.danger}</summary>
        <form action={deleteBusiness} className="space-y-3 border-t p-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={b.id} />
          <label className="block space-y-1 text-sm"><span>{n.deleteHint}</span><Input name="confirm" autoComplete="off" /></label>
          <Button type="submit" variant="outline" size="sm" className="text-destructive">{n.delete}</Button>
        </form>
      </details>
    </>
  );
}
