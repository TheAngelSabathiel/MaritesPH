"use client";

/**
 * "Report outdated info": a disclosure with a short form. Submits to the
 * reportContent Server Action. Works without JavaScript for the disclosure
 * itself (<details>); the form needs JS only for the status message.
 */
import { useActionState, useId } from "react";
import { reportContent } from "@/lib/report/actions";
import type { ReportState } from "@/lib/report/schema";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ReportStrings = {
  button: string;
  title: string;
  intro: string;
  reasonLabel: string;
  reasons: Record<"outdated" | "incorrect" | "fixer" | "other", string>;
  detailsLabel: string;
  detailsPlaceholder: string;
  evidenceLabel: string;
  submit: string;
  sending: string;
  thanks: string;
  tooMany: string;
  signInNeeded: string;
  error: string;
  invalid: string;
  privacy: string;
};

const fieldClass = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base";

export function ReportButton({
  targetType,
  targetId,
  t,
  signInHref,
  signInLabel,
}: {
  targetType: "document" | "office";
  targetId: string;
  t: ReportStrings;
  signInHref: string;
  signInLabel: string;
}) {
  const [state, action, pending] = useActionState<ReportState, FormData>(reportContent, { status: "idle" });
  const id = useId();

  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 font-semibold text-primary">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
          <path d="M3 1h1v14H3zM5 2h8l-2 3 2 3H5z" />
        </svg>
        {t.button}
      </summary>
      <div className="space-y-4 border-t p-4">
        {state.status === "ok" ? (
          <Alert tone="success">{t.thanks}</Alert>
        ) : (
          <form action={action} className="space-y-4">
            <p className="font-bold">{t.title}</p>
            <p className="text-sm">{t.intro}</p>
            <input type="hidden" name="target_type" value={targetType} />
            <input type="hidden" name="target_id" value={targetId} />
            {/* Honeypot: hidden from people and screen readers; bots fill it. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-reason`}>{t.reasonLabel}</Label>
              <select id={`${id}-reason`} name="reason" required defaultValue="outdated" className={fieldClass}>
                {(Object.keys(t.reasons) as (keyof ReportStrings["reasons"])[]).map((key) => (
                  <option key={key} value={key}>
                    {t.reasons[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-details`}>{t.detailsLabel}</Label>
              <textarea id={`${id}-details`} name="details" required minLength={5} maxLength={1000} rows={3} placeholder={t.detailsPlaceholder} className={`${fieldClass} min-h-24`} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-evidence`}>{t.evidenceLabel}</Label>
              <Input id={`${id}-evidence`} name="evidence_url" type="url" inputMode="url" placeholder="https://" />
            </div>

            {state.status === "invalid" ? <Alert tone="caution">{t.invalid}</Alert> : null}
            {state.status === "limited" ? <Alert tone="caution">{t.tooMany}</Alert> : null}
            {state.status === "error" ? <Alert tone="caution">{t.error}</Alert> : null}
            {state.status === "signin" ? (
              <Alert tone="caution">
                <p>{t.signInNeeded}</p>
                <a href={signInHref} className="inline-flex min-h-11 items-center font-semibold underline">
                  {signInLabel}
                </a>
              </Alert>
            ) : null}

            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? t.sending : t.submit}
            </Button>
            <p className="text-sm text-muted-foreground">{t.privacy}</p>
          </form>
        )}
      </div>
    </details>
  );
}
