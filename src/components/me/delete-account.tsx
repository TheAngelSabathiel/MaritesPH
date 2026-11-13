"use client";

/** "Delete my account" with a typed confirmation (RA 10173 right to erasure). */
import { useActionState, useId } from "react";
import { deleteAccount } from "@/lib/me/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteAccount({
  locale,
  email,
  t,
}: {
  locale: string;
  email: string;
  t: { deleteHeading: string; deleteBody: string; deleteConfirmLabel: string; deleteButton: string; deleteMismatch: string; deleteUnavailable: string; deleteError: string };
}) {
  const [state, action, pending] = useActionState(deleteAccount, { status: "idle" as const });
  const id = useId();
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <p className="font-bold">{t.deleteHeading}</p>
      <p className="text-sm">{t.deleteBody}</p>
      <label htmlFor={id} className="text-sm font-semibold">
        {t.deleteConfirmLabel}
      </label>
      <Input id={id} name="confirm" autoComplete="off" />
      {state.status === "mismatch" ? <Alert tone="caution">{t.deleteMismatch}</Alert> : null}
      {state.status === "unavailable" ? <Alert tone="caution">{t.deleteUnavailable.replace("{email}", email)}</Alert> : null}
      {state.status === "error" ? <Alert tone="caution">{t.deleteError.replace("{email}", email)}</Alert> : null}
      <Button type="submit" variant="outline" disabled={pending} className="w-full border-destructive text-destructive sm:w-auto">
        {t.deleteButton}
      </Button>
    </form>
  );
}
