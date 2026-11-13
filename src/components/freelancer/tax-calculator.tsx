"use client";

/**
 * Tax computation in the browser (instant "what if"). Uses ONLY the published,
 * CPA-reviewed rule rows passed in from the server and the same engine as the
 * tests. Nothing is saved or filed. Shows the rules used and their review state.
 */
import { useId, useState } from "react";
import type { Messages } from "@/i18n/dictionaries";
import { compareOptions, quarterlyBreakdown, type RuleRow } from "@/lib/engines/tax";
import { formatPeso } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

type T = Messages["freelancer"]["tax"];
const num = (s: string) => Math.max(0, Number(s.replace(/,/g, "")) || 0);

export function TaxCalculator(props: {
  rules: RuleRow[];
  year: number;
  initial: { gross: number; expenses: number; deduction: "osd" | "itemized"; vat: boolean; quarters: { gross: number; expenses: number }[] };
  option: "eight_percent" | "graduated" | "undecided";
  t: T;
  freelancerT: Messages["freelancer"];
}) {
  const { t } = props;
  const id = useId();
  const [gross, setGross] = useState(String(props.initial.gross));
  const [other, setOther] = useState("0");
  const [comp, setComp] = useState("0");
  const [expenses, setExpenses] = useState(String(props.initial.expenses));
  const [deduction, setDeduction] = useState(props.initial.deduction);
  const [vat, setVat] = useState(props.initial.vat);

  const r = compareOptions({ year: props.year, grossReceipts: num(gross), otherIncome: num(other), compensationIncome: num(comp), itemizedExpenses: num(expenses), deductionMethod: deduction, vatRegistered: vat }, props.rules);
  if (r.status !== "ok") return <Alert tone="caution">{props.freelancerT.noRules}</Alert>;
  const qOption = props.option === "undecided" ? r.recommended : props.option;
  const q = quarterlyBreakdown(qOption, props.initial.quarters, { year: props.year, deductionMethod: deduction, vatRegistered: vat }, props.rules);

  const box = (label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-1"><label htmlFor={`${id}-${label}`} className="text-sm font-semibold">{label}</label><Input id={`${id}-${label}`} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} /></div>
  );
  const row = (label: string, value: number, strong = false) => (
    <div className={`flex justify-between gap-3 ${strong ? "border-t pt-2 font-bold" : ""}`}><dt>{label}</dt><dd>{formatPeso(value)}</dd></div>
  );

  return (
    <div className="space-y-5">
      {!r.allCpaReviewed ? <Alert tone="caution">{props.freelancerT.cpaUnreviewed}</Alert> : null}
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
        {box(t.gross, gross, setGross)}
        {box(t.otherIncome, other, setOther)}
        {box(t.compensation, comp, setComp)}
        {box(t.expenses, expenses, setExpenses)}
        <div className="space-y-1">
          <label htmlFor={`${id}-ded`} className="text-sm font-semibold">{t.deduction}</label>
          <select id={`${id}-ded`} value={deduction} onChange={(e) => setDeduction(e.target.value as "osd" | "itemized")} className="flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base">
            <option value="osd">{props.freelancerT.profile.deductions.osd}</option>
            <option value="itemized">{props.freelancerT.profile.deductions.itemized}</option>
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-3 self-end"><input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} className="size-5" />{t.vat}</label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className={`rounded-lg border bg-card p-4 ${r.recommended === "eight_percent" ? "border-2 border-folder" : ""}`}>
          <h3 className="mb-2 font-bold">{t.eightHeading}</h3>
          {r.eightPercent.eligible ? <dl className="space-y-1 text-sm">{row(t.incomeTax, r.eightPercent.incomeTax)}{row(t.total, r.eightPercent.total, true)}</dl> : <p className="text-sm text-muted-foreground">{t.ineligible[r.eightPercent.reason]}</p>}
        </section>
        <section className={`rounded-lg border bg-card p-4 ${r.recommended === "graduated" ? "border-2 border-folder" : ""}`}>
          <h3 className="mb-2 font-bold">{t.gradHeading}</h3>
          <dl className="space-y-1 text-sm">{row(t.deductionLine, r.graduated.deduction)}{row(t.taxable, r.graduated.taxableIncome)}{row(t.incomeTax, r.graduated.incomeTax)}{row(t.percentageTax, r.graduated.percentageTax)}{row(t.total, r.graduated.total, true)}</dl>
        </section>
      </div>
      <p className="font-semibold">{r.eightPercent.eligible ? t.recommendation[r.recommended].replace("{difference}", formatPeso(r.difference)) : t.recommendationNoEight}</p>
      <p className="text-sm text-muted-foreground">{t.choiceNote}</p>

      {q.status === "ok" ? (
        <section className="space-y-2">
          <h3 className="font-bold">{t.quarterlyHeading.replace("{option}", qOption === "eight_percent" ? t.eightHeading : t.gradHeading)}</h3>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted"><tr><th className="p-2">{t.quarterly.quarter}</th><th className="p-2">{t.quarterly.cumulative}</th><th className="p-2">{t.quarterly.incomeTax}</th><th className="p-2">{t.quarterly.percentageTax}</th></tr></thead>
              <tbody>{q.lines.map((l) => <tr key={l.quarter} className="border-t"><td className="p-2">Q{l.quarter}</td><td className="p-2">{formatPeso(l.cumulativeGross)}</td><td className="p-2">{formatPeso(l.incomeTaxDue)}</td><td className="p-2">{formatPeso(l.percentageTax)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-1 text-sm">
        <h3 className="font-bold">{t.rulesHeading}</h3>
        <ul className="space-y-1">
          {r.rulesUsed.map((u) => (
            <li key={u.id}>
              <span className="font-mono">{u.key}</span> {t.from.replace("{date}", u.effectiveFrom)}:{" "}
              <span className={u.cpaReviewed ? "font-semibold text-stamp" : "font-semibold text-caution"}>{u.cpaReviewed ? t.cpaReviewed : t.notCpaReviewed}</span>
              {u.sourceUrl ? <> · <a href={u.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">source</a></> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
