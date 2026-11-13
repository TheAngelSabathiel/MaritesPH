/**
 * Tax engine (Phase 7): income tax for self-employed individuals and
 * professionals, comparing the 8% option with graduated rates (+ percentage tax),
 * plus quarterly breakdowns and the filing calendar.
 *
 * NO RATES ARE HARDCODED. Every number comes from effective-dated rows in
 * tax_rules / tax_deadlines, validated here by rule key. Every result lists
 * the rules used, their sources, and whether a CPA reviewed them.
 * This is guidance and computation help, not professional tax advice.
 * All worked examples in the tests are marked TO VERIFY WITH CPA.
 */
import { z } from "zod";
import { contributionSchemas } from "./contributions";

export type RuleRow = {
  id: string;
  rule_key: string;
  parameters: unknown;
  effective_from: string;
  effective_to: string | null;
  cpa_reviewed: boolean;
  source_url: string | null;
};
export type RuleRef = { id: string; key: string; effectiveFrom: string; sourceUrl: string | null; cpaReviewed: boolean };

export const RULE_KEYS = {
  graduated: "income_tax.graduated",
  eightPercent: "income_tax.eight_percent",
  osd: "income_tax.osd",
  percentageTax: "percentage_tax.rate",
} as const;

const rate = z.number().min(0).max(1);
const peso = z.number().min(0);
export const ruleParameterSchemas: Record<string, z.ZodType> = {
  ...contributionSchemas,
  [RULE_KEYS.graduated]: z.object({
    brackets: z.array(z.object({ over: peso, upTo: peso.nullable(), base: peso, rate })).min(1),
  }),
  [RULE_KEYS.eightPercent]: z.object({ rate, exemptAmount: peso, grossThreshold: peso }),
  [RULE_KEYS.osd]: z.object({ rate }),
  [RULE_KEYS.percentageTax]: z.object({ rate }),
};

/** The rule version in effect on a date (ISO). Effective ranges are [from, to). */
export function ruleOn(rules: RuleRow[], key: string, date: string): RuleRow | null {
  return rules.find((r) => r.rule_key === key && r.effective_from <= date && (r.effective_to == null || date < r.effective_to)) ?? null;
}

type Params = {
  graduated: { brackets: { over: number; upTo: number | null; base: number; rate: number }[] };
  eight: { rate: number; exemptAmount: number; grossThreshold: number };
  osd: { rate: number };
  pt: { rate: number };
};

function loadParams(rules: RuleRow[], date: string): { ok: true; p: Params; used: RuleRef[] } | { ok: false; missing: string[] } {
  const keys = [RULE_KEYS.graduated, RULE_KEYS.eightPercent, RULE_KEYS.osd, RULE_KEYS.percentageTax];
  const found = keys.map((k) => ruleOn(rules, k, date));
  const missing = keys.filter((k, i) => !found[i] || !ruleParameterSchemas[k].safeParse(found[i]!.parameters).success);
  if (missing.length) return { ok: false, missing };
  const [g, e, o, pt] = found as RuleRow[];
  return {
    ok: true,
    p: { graduated: g.parameters as Params["graduated"], eight: e.parameters as Params["eight"], osd: o.parameters as Params["osd"], pt: pt.parameters as Params["pt"] },
    used: found.map((r) => ({ id: r!.id, key: r!.rule_key, effectiveFrom: r!.effective_from, sourceUrl: r!.source_url, cpaReviewed: r!.cpa_reviewed })),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function graduatedTax(taxable: number, brackets: Params["graduated"]["brackets"]): number {
  if (taxable <= 0) return 0;
  const b = [...brackets].sort((x, y) => x.over - y.over).filter((x) => taxable > x.over).at(-1);
  return b ? round2(b.base + b.rate * (taxable - b.over)) : 0;
}

export type TaxInput = {
  year: number;
  /** Gross sales/receipts from business or profession, in PHP. */
  grossReceipts: number;
  /** Other non-operating business income, in PHP. */
  otherIncome: number;
  /** Compensation from employment (mixed-income earners), in PHP. */
  compensationIncome: number;
  itemizedExpenses: number;
  deductionMethod: "osd" | "itemized";
  vatRegistered: boolean;
};

export type TaxComparison =
  | {
      status: "ok";
      eightPercent: { eligible: true; incomeTax: number; total: number } | { eligible: false; reason: "vat_registered" | "over_threshold" };
      graduated: { deduction: number; taxableIncome: number; incomeTax: number; percentageTax: number; total: number };
      recommended: "eight_percent" | "graduated";
      difference: number;
      rulesUsed: RuleRef[];
      allCpaReviewed: boolean;
    }
  | { status: "missing_rules"; missing: string[] };

export function compareOptions(input: TaxInput, rules: RuleRow[]): TaxComparison {
  const loaded = loadParams(rules, `${input.year}-12-31`);
  if (!loaded.ok) return { status: "missing_rules", missing: loaded.missing };
  const { p, used } = loaded;
  const business = input.grossReceipts + input.otherIncome;
  const mixed = input.compensationIncome > 0;

  // Graduated: net business income + compensation through the table; percentage tax on gross (non-VAT).
  const deduction = input.deductionMethod === "osd" ? round2(p.osd.rate * business) : input.itemizedExpenses;
  const taxableIncome = Math.max(0, round2(business - deduction)) + input.compensationIncome;
  const gIncomeTax = graduatedTax(taxableIncome, p.graduated.brackets);
  const percentageTax = input.vatRegistered ? 0 : round2(p.pt.rate * input.grossReceipts);
  const graduated = { deduction, taxableIncome, incomeTax: gIncomeTax, percentageTax, total: round2(gIncomeTax + percentageTax) };

  // 8%: in lieu of graduated rates AND percentage tax, on gross; the exempt amount applies only
  // to purely self-employed; mixed earners pay graduated tax on compensation separately.
  let eightPercent: Extract<TaxComparison, { status: "ok" }>["eightPercent"];
  if (input.vatRegistered) eightPercent = { eligible: false, reason: "vat_registered" };
  else if (business > p.eight.grossThreshold) eightPercent = { eligible: false, reason: "over_threshold" };
  else {
    const base = mixed ? business : Math.max(0, business - p.eight.exemptAmount);
    const onBusiness = round2(p.eight.rate * base);
    const onCompensation = mixed ? graduatedTax(input.compensationIncome, p.graduated.brackets) : 0;
    const total = round2(onBusiness + onCompensation);
    eightPercent = { eligible: true, incomeTax: total, total };
  }

  const recommended = eightPercent.eligible && eightPercent.total < graduated.total ? "eight_percent" : "graduated";
  const difference = eightPercent.eligible ? round2(Math.abs(graduated.total - eightPercent.total)) : 0;
  return { status: "ok", eightPercent, graduated, recommended, difference, rulesUsed: used, allCpaReviewed: used.every((u) => u.cpaReviewed) };
}

export type QuarterLine = { quarter: 1 | 2 | 3; cumulativeGross: number; incomeTaxDue: number; percentageTax: number };

/**
 * Quarterly income tax (cumulative method): each quarter's return covers the
 * year to date, minus what earlier quarters already paid. Q4 is settled in the
 * annual return. Percentage tax is per quarter (graduated option, non-VAT).
 */
export function quarterlyBreakdown(
  option: "eight_percent" | "graduated",
  quarters: { gross: number; expenses: number }[],
  input: Pick<TaxInput, "year" | "deductionMethod" | "vatRegistered">,
  rules: RuleRow[],
): { status: "ok"; lines: QuarterLine[] } | { status: "missing_rules"; missing: string[] } {
  const loaded = loadParams(rules, `${input.year}-12-31`);
  if (!loaded.ok) return { status: "missing_rules", missing: loaded.missing };
  const { p } = loaded;
  let gross = 0;
  let expenses = 0;
  let paid = 0;
  const lines: QuarterLine[] = [];
  for (const q of [1, 2, 3] as const) {
    gross += quarters[q - 1]?.gross ?? 0;
    expenses += quarters[q - 1]?.expenses ?? 0;
    const cumulativeTax =
      option === "eight_percent"
        ? round2(p.eight.rate * Math.max(0, gross - p.eight.exemptAmount))
        : graduatedTax(gross - (input.deductionMethod === "osd" ? round2(p.osd.rate * gross) : expenses), p.graduated.brackets);
    const due = Math.max(0, round2(cumulativeTax - paid));
    paid += due;
    const percentageTax = option === "graduated" && !input.vatRegistered ? round2(p.pt.rate * (quarters[q - 1]?.gross ?? 0)) : 0;
    lines.push({ quarter: q, cumulativeGross: round2(gross), incomeTaxDue: due, percentageTax });
  }
  return { status: "ok", lines };
}

// ---------------------------------------------------------------------------
// Filing calendar
// ---------------------------------------------------------------------------
export const dueRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("quarterly_fixed"), dates: z.array(z.object({ quarter: z.number().int().min(1).max(4), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) })).min(1) }),
  z.object({ kind: z.literal("after_quarter_end"), days: z.number().int().min(1).max(120), quarters: z.array(z.number().int().min(1).max(4)).default([1, 2, 3, 4]) }),
  z.object({ kind: z.literal("annual_fixed"), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31), yearOffset: z.number().int().min(0).max(1).default(1) }),
  // Employer remittances (Phase 9): due on a fixed day of the following month...
  z.object({ kind: z.literal("monthly_fixed"), day: z.number().int().min(1).max(31) }),
  // ...or on a day set by a digit of the employer number (e.g. {"0":10,"1":10,...}).
  z.object({ kind: z.literal("monthly_by_digit"), digitOf: z.enum(["sss", "philhealth"]), days: z.record(z.string().regex(/^[0-9]$/), z.number().int().min(1).max(31)) }),
]);

export type DeadlineRow = { id: string; form_code: string; frequency: string; due_rule: unknown; applies_to: string[]; description: string | null; effective_from: string; effective_to: string | null; cpa_reviewed: boolean; source_url: string | null };
export type Deadline = { key: string; formCode: string; period: string; dueOn: string; description: string | null; sourceUrl: string | null; cpaReviewed: boolean; movedFromWeekend: boolean };

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Due dates on a Saturday or Sunday move to Monday. Philippine holidays are NOT applied (README). */
function nextWorkday(date: Date): { date: Date; moved: boolean } {
  const day = date.getUTCDay();
  if (day === 6) return { date: new Date(date.getTime() + 2 * 86_400_000), moved: true };
  if (day === 0) return { date: new Date(date.getTime() + 86_400_000), moved: true };
  return { date, moved: false };
}

/** Deadlines for a taxable year, for a taxpayer's option (applies_to contains it or "all"). */
export function filingCalendar(rows: DeadlineRow[], taxYear: number, taxOption: "eight_percent" | "graduated" | "undecided"): Deadline[] {
  const out: Deadline[] = [];
  for (const row of rows) {
    if (!(row.applies_to.includes("all") || row.applies_to.includes(taxOption) || taxOption === "undecided")) continue;
    if (!(row.effective_from <= `${taxYear}-12-31` && (row.effective_to == null || `${taxYear}-01-01` < row.effective_to))) continue;
    const rule = dueRuleSchema.safeParse(row.due_rule);
    if (!rule.success) continue;
    const add = (period: string, raw: Date) => {
      const { date, moved } = nextWorkday(raw);
      out.push({ key: `${row.form_code}:${taxYear}:${period}`, formCode: row.form_code, period, dueOn: iso(date), description: row.description, sourceUrl: row.source_url, cpaReviewed: row.cpa_reviewed, movedFromWeekend: moved });
    };
    const r = rule.data;
    if (r.kind === "quarterly_fixed") for (const d of r.dates) add(`Q${d.quarter}`, new Date(Date.UTC(taxYear, d.month - 1, d.day)));
    if (r.kind === "after_quarter_end") for (const q of r.quarters) add(`Q${q}`, new Date(Date.UTC(taxYear, q * 3, 1) + (r.days - 1) * 86_400_000));
    if (r.kind === "annual_fixed") add("Annual", new Date(Date.UTC(taxYear + r.yearOffset, r.month - 1, r.day)));
  }
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.formCode.localeCompare(b.formCode));
}

/**
 * Employer remittance deadlines for one applicable month (YYYY-MM): deadlines
 * with applies_to "employer" and a monthly rule. Due the following month.
 * Digit-based rules need the business's digit; without it the deadline is
 * returned with dueOn null ("set your employer number digit").
 */
export function remittanceCalendar(rows: DeadlineRow[], period: string, digits: { sss: number | null; philhealth: number | null }) {
  const [y, m] = period.split("-").map(Number);
  const due = (day: number) => {
    const raw = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, day));
    return nextWorkday(raw);
  };
  const out: (Omit<Deadline, "dueOn"> & { dueOn: string | null })[] = [];
  for (const row of rows) {
    if (!row.applies_to.includes("employer")) continue;
    if (!(row.effective_from <= `${period}-01` && (row.effective_to == null || `${period}-01` < row.effective_to))) continue;
    const rule = dueRuleSchema.safeParse(row.due_rule);
    if (!rule.success) continue;
    const r = rule.data;
    let dueOn: string | null = null;
    let moved = false;
    if (r.kind === "monthly_fixed") ({ date: dueOn, moved } = ((x) => ({ date: iso(x.date), moved: x.moved }))(due(r.day)));
    else if (r.kind === "monthly_by_digit") {
      const d = digits[r.digitOf];
      const day = d == null ? undefined : r.days[String(d)];
      if (day) ({ date: dueOn, moved } = ((x) => ({ date: iso(x.date), moved: x.moved }))(due(day)));
    } else continue;
    out.push({ key: `${row.form_code}:${period}`, formCode: row.form_code, period, dueOn, description: row.description, sourceUrl: row.source_url, cpaReviewed: row.cpa_reviewed, movedFromWeekend: moved });
  }
  return out;
}
