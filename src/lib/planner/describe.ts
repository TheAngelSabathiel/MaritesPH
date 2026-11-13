/**
 * Turns the planner's structured codes into sentences in the current language.
 * Pure: takes the message strings, so it works in Server and Client Components
 * and is unit-tested. All wording lives in src/i18n/messages.
 */
import type { Messages } from "@/i18n/dictionaries";
import type { Day } from "@/lib/content/hours";
import { formatTime } from "@/lib/content/offices";
import type { OfficeReason } from "@/lib/engines/offices";
import type { PlanOption, RecommendationReason, Risk, StepWhen, Strategy } from "@/lib/engines/planner";
import { feeDisplay, formatPeso } from "@/lib/format";

export type PlannerStrings = Messages["planner"];
export type DayNames = Record<Day, string>;

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

export function strategyLabel(t: PlannerStrings, key: Strategy): string {
  return t.strategies[key];
}

export function alsoBestText(t: PlannerStrings, keys: Strategy[]): string | null {
  return keys.length ? fill(t.alsoBest, { list: keys.map((k) => t.strategies[k]).join(", ") }) : null;
}

export function whenText(t: PlannerStrings, days: DayNames, when: StepWhen): string {
  if (when.kind === "online" || when.kind === "no_office") return t.when[when.kind];
  return fill(t.when[when.kind], { day: days[when.day], start: formatTime(when.start), end: formatTime(when.end) });
}

export function officeReasonText(t: PlannerStrings, r: OfficeReason): string {
  const values: Record<string, string | number> = {};
  // City-centre origins can put an office at "0 km"; say "<1" instead.
  if ("km" in r) values.km = r.km < 1 ? "<1" : r.km;
  if ("days" in r) values.days = r.days;
  if ("minutes" in r) values.minutes = r.minutes;
  return fill(t.officeReasons[r.code], values);
}

export function riskText(t: PlannerStrings, r: Risk): string {
  switch (r.code) {
    case "over_budget":
      return fill(t.risks.over_budget, { budget: formatPeso(r.budget), costMin: formatPeso(r.costMin) });
    default: {
      const { code, ...values } = r;
      return fill(t.risks[code], values as Record<string, string | number>);
    }
  }
}

export function reasonText(t: PlannerStrings, r: RecommendationReason): string {
  return t.recommendationReasons[r.code];
}

export function costText(t: PlannerStrings, o: PlanOption, freeLabel: string): string {
  const fee = feeDisplay(o.totals.costMin, o.totals.costMax);
  const base =
    fee.kind === "free" ? freeLabel : fee.kind === "amount" ? fee.text : fee.kind === "range" ? `${fee.min} – ${fee.max}` : t.totals.none;
  return o.totals.costUnknown ? base + t.totals.unknownSuffix : base;
}

export function daysText(t: PlannerStrings, o: PlanOption): string {
  const { daysMin, daysMax, daysUnknown } = o.totals;
  const base = daysMin === daysMax ? fill(t.totals.daysSingle, { days: daysMax }) : fill(t.totals.days, { min: daysMin, max: daysMax });
  return daysUnknown ? base + t.totals.unknownSuffix : base;
}

/** "{goal} plan" title for saving. */
export function planTitle(t: PlannerStrings, goalName: string): string {
  return fill(t.planTitle, { goal: goalName });
}

/** Travel time chip text, or null when it would say "0 minutes". */
export function travelText(t: PlannerStrings, minutes: number | null): string | null {
  return minutes != null && minutes >= 1 ? t.travel.replace("{minutes}", String(minutes)) : null;
}
