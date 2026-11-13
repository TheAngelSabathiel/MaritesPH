"use client";

/** Share a tip about an office. Reviewed before it appears; fixer patterns are refused. */
import { useActionState, useId } from "react";
import type { Messages } from "@/i18n/dictionaries";
import { submitTip, type TipState } from "@/lib/community/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fieldClass = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base";

export function TipForm({ officeId, t, signInHref, signInLabel }: { officeId: string; t: Messages["tips"]; signInHref: string; signInLabel: string }) {
  const [state, action, pending] = useActionState<TipState, FormData>(submitTip, { status: "idle" });
  const id = useId();
  if (state.status === "sent") return <Alert tone="success">{t.sent}</Alert>;
  return (
    <details className="rounded-lg border bg-card">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold text-primary">{t.formHeading}</summary>
      <form action={action} className="space-y-4 border-t p-4">
        <input type="hidden" name="officeId" value={officeId} />
        <p className="text-sm text-muted-foreground">{t.rules}</p>
        <div className="space-y-2">
          <label htmlFor={`${id}-b`} className="text-sm font-semibold">{t.bodyLabel}</label>
          <textarea id={`${id}-b`} name="body" required minLength={10} maxLength={500} rows={3} placeholder={t.bodyPlaceholder} className={`${fieldClass} min-h-24`} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor={`${id}-w`} className="text-sm font-semibold">{t.waitLabel}</label>
            <Input id={`${id}-w`} name="waitMinutes" type="number" inputMode="numeric" min={0} max={720} />
          </div>
          <div className="space-y-2">
            <label htmlFor={`${id}-v`} className="text-sm font-semibold">{t.visitedLabel}</label>
            <Input id={`${id}-v`} name="visitedOn" type="date" />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor={`${id}-e`} className="text-sm font-semibold">{t.extraLabel}</label>
          <Input id={`${id}-e`} name="extra" maxLength={300} />
        </div>
        {state.status === "signin" ? (
          <Alert tone="caution">{t.signin} <a href={signInHref} className="inline-flex min-h-11 items-center font-semibold underline">{signInLabel}</a></Alert>
        ) : state.status !== "idle" ? (
          <Alert tone="caution">{t[state.status]}</Alert>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? t.sending : t.submit}</Button>
      </form>
    </details>
  );
}
