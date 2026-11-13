/**
 * Employer contributions engine (Phase 9): SSS, PhilHealth, Pag-IBIG.
 * NO RATES ARE HARDCODED: parameters come from effective-dated tax_rules rows
 * (keys contribution.sss / contribution.philhealth / contribution.pagibig),
 * which need verification and CPA review like tax rules. Results list the
 * rules used. Worked examples in tests are TO VERIFY with the agencies/a CPA.
 */
import { z } from "zod";
import type { RuleRef, RuleRow } from "./tax";

const rate = z.number().min(0).max(1);
const peso = z.number().min(0);
export const CONTRIBUTION_KEYS = { sss: "contribution.sss", philhealth: "contribution.philhealth", pagibig: "contribution.pagibig" } as const;
export type Agency = keyof typeof CONTRIBUTION_KEYS;

export const contributionSchemas: Record<string, z.ZodType> = {
  // Monthly salary credit (MSC): salary rounded to the nearest step, clamped. EC is employer-paid.
  [CONTRIBUTION_KEYS.sss]: z.object({ mscMin: peso, mscMax: peso, mscStep: z.number().positive(), employeeRate: rate, employerRate: rate, ecThreshold: peso, ecLow: peso, ecHigh: peso }),
  // Premium = rate × salary clamped to [floor, ceiling]; employeeShare of it is deducted from salary.
  [CONTRIBUTION_KEYS.philhealth]: z.object({ rate, floor: peso, ceiling: peso, employeeShare: rate }),
  // Rates apply to compensation up to maxCompensation; employee rate is lower at or below lowThreshold.
  [CONTRIBUTION_KEYS.pagibig]: z.object({ employeeRateLow: rate, employeeRateHigh: rate, lowThreshold: peso, employerRate: rate, maxCompensation: peso }),
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const ruleOn = (rules: RuleRow[], key: string, date: string) =>
  rules.find((r) => r.rule_key === key && r.effective_from <= date && (r.effective_to == null || date < r.effective_to)) ?? null;

export type ContributionLine = { agency: Agency; basis: number; employee: number; employer: number };
export type ContributionResult =
  | { status: "ok"; lines: ContributionLine[]; employeeTotal: number; employerTotal: number; rulesUsed: RuleRef[]; allCpaReviewed: boolean }
  | { status: "missing_rules"; missing: string[] };

export function computeContributions(monthlySalary: number, date: string, rules: RuleRow[]): ContributionResult {
  const found = (Object.values(CONTRIBUTION_KEYS) as string[]).map((k) => [k, ruleOn(rules, k, date)] as const);
  const missing = found.filter(([k, r]) => !r || !contributionSchemas[k].safeParse(r.parameters).success).map(([k]) => k);
  if (missing.length) return { status: "missing_rules", missing };
  const p = Object.fromEntries(found.map(([k, r]) => [k, r!.parameters])) as Record<string, Record<string, number>>;
  const s = Math.max(0, monthlySalary);

  const sss = p[CONTRIBUTION_KEYS.sss];
  const msc = Math.min(sss.mscMax, Math.max(sss.mscMin, Math.round(s / sss.mscStep) * sss.mscStep));
  const ec = msc < sss.ecThreshold ? sss.ecLow : sss.ecHigh;
  const ph = p[CONTRIBUTION_KEYS.philhealth];
  const premium = r2(ph.rate * Math.min(ph.ceiling, Math.max(ph.floor, s)));
  const pi = p[CONTRIBUTION_KEYS.pagibig];
  const piBasis = Math.min(s, pi.maxCompensation);

  const lines: ContributionLine[] = [
    { agency: "sss", basis: msc, employee: r2(sss.employeeRate * msc), employer: r2(sss.employerRate * msc + ec) },
    { agency: "philhealth", basis: Math.min(ph.ceiling, Math.max(ph.floor, s)), employee: r2(premium * ph.employeeShare), employer: r2(premium - r2(premium * ph.employeeShare)) },
    { agency: "pagibig", basis: piBasis, employee: r2((s <= pi.lowThreshold ? pi.employeeRateLow : pi.employeeRateHigh) * piBasis), employer: r2(pi.employerRate * piBasis) },
  ];
  const used = found.map(([, r]) => ({ id: r!.id, key: r!.rule_key, effectiveFrom: r!.effective_from, sourceUrl: r!.source_url, cpaReviewed: r!.cpa_reviewed }));
  return {
    status: "ok",
    lines,
    employeeTotal: r2(lines.reduce((a, l) => a + l.employee, 0)),
    employerTotal: r2(lines.reduce((a, l) => a + l.employer, 0)),
    rulesUsed: used,
    allCpaReviewed: used.every((u) => u.cpaReviewed),
  };
}
