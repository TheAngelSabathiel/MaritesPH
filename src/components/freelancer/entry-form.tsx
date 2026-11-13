"use client";

/** Add an income or expense entry. Foreign currency needs the rate used; PHP is computed on the server. */
import { useActionState, useId, useState } from "react";
import type { Messages } from "@/i18n/dictionaries";
import { addEntry, type FormState } from "@/lib/freelancer/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const field = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base";
const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY"];

export function EntryForm({ kind, locale, t, saved, error, partial }: { kind: "income" | "expense"; locale: string; t: Messages["freelancer"]["tracker"]; saved: string; error: string; partial: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addEntry, { status: "idle" });
  const [currency, setCurrency] = useState("PHP");
  const id = useId();
  const categories = kind === "income" ? t.incomeCategories : t.expenseCategories;
  return (
    <details className="rounded-lg border bg-card">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold text-primary">{kind === "income" ? t.addIncome : t.addExpense}</summary>
      <form action={action} className="grid gap-3 border-t p-4 sm:grid-cols-2">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="kind" value={kind} />
        <div className="space-y-1"><label htmlFor={`${id}-d`} className="text-sm font-semibold">{t.date}</label><Input id={`${id}-d`} name="date" type="date" required /></div>
        <div className="space-y-1"><label htmlFor={`${id}-c`} className="text-sm font-semibold">{t.category}</label>
          <select id={`${id}-c`} name="category" className={field}>{Object.entries(categories).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div className="space-y-1"><label htmlFor={`${id}-a`} className="text-sm font-semibold">{t.amount}</label><Input id={`${id}-a`} name="amount" inputMode="decimal" required /></div>
        <div className="space-y-1"><label htmlFor={`${id}-cur`} className="text-sm font-semibold">{t.currency}</label>
          <select id={`${id}-cur`} name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {currency !== "PHP" ? (
          <div className="space-y-1 sm:col-span-2"><label htmlFor={`${id}-fx`} className="text-sm font-semibold">{t.rate}</label><Input id={`${id}-fx`} name="fx_rate" inputMode="decimal" required /><p className="text-sm text-muted-foreground">{t.rateHint}</p></div>
        ) : null}
        <div className="space-y-1 sm:col-span-2"><label htmlFor={`${id}-n`} className="text-sm font-semibold">{t.notes}</label><Input id={`${id}-n`} name="notes" maxLength={300} /></div>
        {state.status === "saved" ? <Alert tone="success" className="sm:col-span-2">{saved}</Alert> : null}
        {state.status === "partial" ? <Alert tone="caution" className="sm:col-span-2">{partial}</Alert> : null}
        {state.status === "error" ? <Alert tone="caution" className="sm:col-span-2">{error}</Alert> : null}
        <Button type="submit" disabled={pending} className="sm:col-span-2 sm:w-auto">{t.add}</Button>
      </form>
    </details>
  );
}
