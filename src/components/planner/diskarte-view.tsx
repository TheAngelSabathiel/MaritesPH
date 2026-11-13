/**
 * "Mga Diskarte": the planner's options with trade-offs and the recommended one.
 * Presentational only (no hooks), so it renders on the server (situation pages,
 * saved plans) and inside the client wizard. Recommended option first.
 * Plain, serious wording inside plans (voice rules): no jokes in steps.
 */
import Link from "next/link";
import { officePath } from "@/lib/content/offices";
import type { PlanOption, PlanResult } from "@/lib/engines/planner";
import {
  alsoBestText,
  costText,
  daysText,
  officeReasonText,
  reasonText,
  riskText,
  strategyLabel,
  travelText,
  whenText,
  type DayNames,
  type PlannerStrings,
} from "@/lib/planner/describe";
import { cn } from "@/lib/utils";

type OkResult = Extract<PlanResult, { status: "ok" }>;

export function DiskarteView({
  result,
  t,
  days,
  freeLabel,
  locale,
  chosen,
}: {
  result: OkResult;
  t: PlannerStrings;
  days: DayNames;
  freeLabel: string;
  locale: string;
  chosen?: string | null;
}) {
  const ordered = [...result.options].sort((a, b) => Number(b.key === result.recommended) - Number(a.key === result.recommended));
  return (
    <ol className="space-y-5">
      {ordered.map((option) => (
        <li key={option.key}>
          <OptionCard
            option={option}
            recommended={option.key === result.recommended}
            reasons={option.key === result.recommended ? result.reasons.map((r) => reasonText(t, r)) : []}
            chosen={chosen === option.key}
            t={t}
            days={days}
            freeLabel={freeLabel}
            locale={locale}
          />
        </li>
      ))}
    </ol>
  );
}

function OptionCard({
  option,
  recommended,
  reasons,
  chosen,
  t,
  days,
  freeLabel,
  locale,
}: {
  option: PlanOption;
  recommended: boolean;
  reasons: string[];
  chosen: boolean;
  t: PlannerStrings;
  days: DayNames;
  freeLabel: string;
  locale: string;
}) {
  const also = alsoBestText(t, option.alsoBest);
  return (
    <article
      aria-label={strategyLabel(t, option.key)}
      className={cn("rounded-lg border bg-card", recommended && "border-2 border-folder", !option.available && "opacity-80")}
    >
      <header className={cn("space-y-1 rounded-t-lg p-4", recommended && "bg-accent text-accent-foreground")}>
        <div className="flex flex-wrap items-center gap-2">
          {recommended ? <span className="rounded-full bg-folder px-2.5 py-0.5 text-xs font-extrabold text-accent-foreground">{t.recommended}</span> : null}
          {!option.available ? <span className="rounded-full bg-caution-soft px-2.5 py-0.5 text-xs font-bold text-caution">{t.unavailable}</span> : null}
          {chosen ? <span className="rounded-full bg-stamp-soft px-2.5 py-0.5 text-xs font-bold text-stamp">{t.chosen}</span> : null}
        </div>
        <h3 className="text-lg font-extrabold leading-snug">{strategyLabel(t, option.key)}</h3>
        {also ? <p className="text-sm font-semibold">{also}</p> : null}
      </header>

      <dl className="grid grid-cols-2 gap-px border-y bg-border">
        <Metric label={t.totals.visits} value={String(option.totals.visits)} />
        <Metric label={t.totals.leave} value={option.totals.leaveDays ? String(option.totals.leaveDays) : t.totals.none} highlight={option.totals.leaveDays > 0} />
        <Metric label={t.totals.cost} value={costText(t, option, freeLabel)} />
        <Metric label={t.totals.time} value={daysText(t, option)} />
      </dl>

      <div className="space-y-4 p-4">
        {reasons.length ? (
          <section>
            <h4 className="text-sm font-bold">{t.whyRecommended}</h4>
            <ul className="list-disc pl-5 text-sm">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h4 className="mb-2 text-sm font-bold">{t.stepsHeading}</h4>
          <ol className="space-y-3">
            {option.steps.map((step, i) => (
              <li key={step.id} className="flex gap-3">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="text-base font-bold leading-snug">{t.getDocument.replace("{document}", step.documentName)}</p>
                  {step.after.length ? (
                    <p className="text-muted-foreground">
                      {t.afterDocs.replace("{list}", step.after.map((id) => option.steps.find((s) => s.documentId === id)?.documentName ?? "").filter(Boolean).join(", "))}
                    </p>
                  ) : null}
                  {step.prepare.length ? <p>{t.bring.replace("{list}", step.prepare.map((p) => p.text).join("; "))}</p> : null}
                  {step.office ? (
                    <p className="font-semibold">
                      {t.goTo.replace("{office}", "")}
                      <Link href={officePath(locale, step.office)} className="text-primary underline underline-offset-2">
                        {step.office.name}
                      </Link>
                    </p>
                  ) : null}
                  <p className={cn(step.when.kind === "leave" || step.when.kind === "no_office" ? "font-semibold text-caution" : "")}>
                    {whenText(t, days, step.when)}
                  </p>
                  {step.office ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {step.officeReasons.slice(0, 3).map((r) => (
                        <li key={JSON.stringify(r)} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {officeReasonText(t, r)}
                        </li>
                      ))}
                      {travelText(t, step.travelMinutes) ? <li className="rounded-full bg-muted px-2 py-0.5 text-xs">{travelText(t, step.travelMinutes)}</li> : null}
                    </ul>
                  ) : null}
                  <Link href={`/${locale}/ids/${step.documentSlug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">
                    {t.seeGuide}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {option.risks.length ? (
          <section className="rounded-md bg-caution-soft p-3">
            <h4 className="text-sm font-bold">{t.risksHeading}</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {option.risks.map((r) => (
                <li key={JSON.stringify(r)}>{riskText(t, r)}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-card p-3">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className={cn("font-bold", highlight && "text-caution")}>{value}</dd>
    </div>
  );
}
