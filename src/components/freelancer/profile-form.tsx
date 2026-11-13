"use client";

/** Taxpayer profile form. Private details are encrypted on the server before storage. */
import { useActionState, useId } from "react";
import type { Messages } from "@/i18n/dictionaries";
import { saveTaxpayerProfile, type FormState } from "@/lib/freelancer/actions";
import type { TaxpayerProfile } from "@/lib/freelancer/data";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type T = Messages["freelancer"];
const field = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base";

function Select({ id, name, label, value, options }: { id: string; name: string; label: string; value: string; options: Record<string, string> }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <select id={id} name={name} defaultValue={value} className={field}>
        {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

export function ProfileForm({ profile, locale, t }: { profile: TaxpayerProfile; locale: string; t: T }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTaxpayerProfile, { status: "idle" });
  const id = useId();
  const p = t.profile;
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id={`${id}-t`} name="taxpayer_type" label={p.taxpayerType} value={profile.taxpayer_type} options={p.taxpayerTypes} />
        <Select id={`${id}-r`} name="registration_status" label={p.registration} value={profile.registration_status} options={p.registrationStatuses} />
        <Select id={`${id}-o`} name="tax_option" label={p.taxOption} value={profile.tax_option} options={p.taxOptions} />
        <Select id={`${id}-d`} name="deduction_method" label={p.deduction} value={profile.deduction_method} options={p.deductions} />
        <Select id={`${id}-v`} name="vat_status" label={p.vat} value={profile.vat_status} options={p.vatStatuses} />
        <div className="space-y-1">
          <label htmlFor={`${id}-rdo`} className="text-sm font-semibold">{p.rdo}</label>
          <Input id={`${id}-rdo`} name="rdo_code" defaultValue={profile.rdo_code ?? ""} placeholder="040" />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-on`} className="text-sm font-semibold">{p.registeredOn}</label>
          <Input id={`${id}-on`} name="registered_on" type="date" defaultValue={profile.registered_on ?? ""} />
        </div>
      </div>

      <fieldset className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
        <legend className="px-1 font-bold">{p.privateHeading}</legend>
        <p className="text-sm text-muted-foreground">{p.privateHint}</p>
        <div className="space-y-1">
          <label htmlFor={`${id}-tin`} className="text-sm font-semibold">{p.tin}</label>
          <Input id={`${id}-tin`} name="tin" inputMode="numeric" autoComplete="off" defaultValue={profile.tin ?? ""} placeholder="000-000-000-000" />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-nm`} className="text-sm font-semibold">{p.registeredName}</label>
          <Input id={`${id}-nm`} name="registered_name" autoComplete="off" defaultValue={profile.registeredName ?? ""} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-ad`} className="text-sm font-semibold">{p.registeredAddress}</label>
          <Input id={`${id}-ad`} name="registered_address" autoComplete="off" defaultValue={profile.registeredAddress ?? ""} />
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
        <legend className="px-1 font-bold">{p.remindersHeading}</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="email_reminders" defaultChecked={profile.email_reminders} className="size-5" />
          {p.emailReminders}
        </label>
        <div className="space-y-1">
          <label htmlFor={`${id}-days`} className="text-sm font-semibold">{p.daysBefore}</label>
          <Input id={`${id}-days`} name="reminder_days_before" type="number" min={1} max={30} defaultValue={profile.reminder_days_before} />
        </div>
      </fieldset>

      {state.status === "saved" ? <Alert tone="success">{t.saved}</Alert> : null}
      {state.status === "partial" ? <Alert tone="caution">{t.encryptionUnavailable}</Alert> : null}
      {state.status === "error" ? <Alert tone="caution">{t.error}</Alert> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">{p.save}</Button>
    </form>
  );
}
