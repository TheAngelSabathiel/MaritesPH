"use client";

/** One document in "My documents": status + optional expiry, saved per row. */
import { useActionState, useId } from "react";
import { setMyDocument } from "@/lib/me/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type MyDocStrings = {
  statusLabel: string;
  statuses: Record<"none" | "have" | "in_progress" | "need", string>;
  expiresLabel: string;
  save: string;
  saved: string;
  error: string;
};

export function MyDocumentRow({
  locale,
  document,
  status,
  expiresOn,
  t,
}: {
  locale: string;
  document: { id: string; name: string };
  status: "none" | "have" | "in_progress" | "need";
  expiresOn: string | null;
  t: MyDocStrings;
}) {
  const [state, action, pending] = useActionState(setMyDocument, { status: "idle" as const });
  const id = useId();
  return (
    <form action={action} className="space-y-3 rounded-lg border bg-card p-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="documentId" value={document.id} />
      <p className="text-lg font-bold">{document.name}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <label htmlFor={`${id}-s`} className="text-sm font-semibold">
            {t.statusLabel.replace("{document}", document.name)}
          </label>
          <select id={`${id}-s`} name="status" defaultValue={status} className="flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base">
            {(Object.keys(t.statuses) as (keyof MyDocStrings["statuses"])[]).map((k) => (
              <option key={k} value={k}>
                {t.statuses[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-e`} className="text-sm font-semibold">
            {t.expiresLabel}
          </label>
          <Input id={`${id}-e`} name="expiresOn" type="date" defaultValue={expiresOn ?? ""} />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {t.save}
        </Button>
      </div>
      {state.status === "saved" ? <p className="text-sm font-semibold text-stamp" role="status">{t.saved}</p> : null}
      {state.status === "error" ? <p className="text-sm font-semibold text-destructive" role="alert">{t.error}</p> : null}
    </form>
  );
}
