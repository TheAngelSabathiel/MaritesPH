/** Phase 9 engines. ALL WORKED EXAMPLES ARE TO VERIFY with SSS, PhilHealth, Pag-IBIG, the LGU, or a CPA. */
import { describe, expect, it } from "vitest";
import { computeContributions } from "@/lib/engines/contributions";
import { lguDeadlinesSchema, lguFeesSchema, lguRequirementsSchema, lguStepsSchema, renewalPlan } from "@/lib/engines/lgu";
import { remittanceCalendar, ruleParameterSchemas, type DeadlineRow, type RuleRow } from "@/lib/engines/tax";

const rule = (key: string, parameters: unknown, cpa = true): RuleRow => ({ id: key, rule_key: key, parameters, effective_from: "2025-01-01", effective_to: null, cpa_reviewed: cpa, source_url: null });
const RULES = [
  rule("contribution.sss", { mscMin: 5000, mscMax: 35000, mscStep: 500, employeeRate: 0.05, employerRate: 0.1, ecThreshold: 15000, ecLow: 10, ecHigh: 30 }),
  rule("contribution.philhealth", { rate: 0.05, floor: 10000, ceiling: 100000, employeeShare: 0.5 }),
  rule("contribution.pagibig", { employeeRateLow: 0.01, employeeRateHigh: 0.02, lowThreshold: 1500, employerRate: 0.02, maxCompensation: 10000 }),
];

describe("contributions (TO VERIFY)", () => {
  it("₱18,000 salary", () => {
    const r = computeContributions(18000, "2026-11-01", RULES);
    expect(r).toMatchObject({
      status: "ok",
      lines: [
        { agency: "sss", basis: 18000, employee: 900, employer: 1830 },
        { agency: "philhealth", basis: 18000, employee: 450, employer: 450 },
        { agency: "pagibig", basis: 10000, employee: 200, employer: 200 },
      ],
      employeeTotal: 1550,
      employerTotal: 2480,
      allCpaReviewed: true,
    });
  });
  it("applies floors, ceilings, rounding, and the lower EC below the threshold", () => {
    const low = computeContributions(4000, "2026-11-01", RULES);
    expect(low).toMatchObject({ lines: [{ basis: 5000, employee: 250, employer: 510 }, { basis: 10000, employee: 250, employer: 250 }, { basis: 4000, employee: 80, employer: 80 }] });
    const high = computeContributions(150000, "2026-11-01", RULES);
    expect(high).toMatchObject({ lines: [{ basis: 35000, employee: 1750 }, { basis: 100000, employee: 2500 }, { basis: 10000, employee: 200 }] });
    const sssBasis = (salary: number) => {
      const r = computeContributions(salary, "2026-11-01", RULES);
      return r.status === "ok" ? r.lines[0].basis : null;
    };
    expect(sssBasis(18240)).toBe(18000); // nearest ₱500 step
    expect(sssBasis(18250)).toBe(18500);
  });
  it("refuses to compute without every rule", () => {
    expect(computeContributions(18000, "2026-11-01", RULES.slice(1))).toEqual({ status: "missing_rules", missing: ["contribution.sss"] });
  });
});

describe("remittance deadlines (TO VERIFY)", () => {
  const row = (form: string, due_rule: unknown): DeadlineRow => ({ id: form, form_code: form, frequency: "monthly", due_rule, applies_to: ["employer"], description: null, effective_from: "2025-01-01", effective_to: null, cpa_reviewed: true, source_url: null });
  const rows = [
    row("SSS", { kind: "monthly_by_digit", digitOf: "sss", days: { "1": 10, "2": 10, "3": 15, "4": 15, "5": 20, "6": 20, "7": 25, "8": 25, "9": 25, "0": 25 } }),
    row("Pag-IBIG", { kind: "monthly_fixed", day: 15 }),
  ];
  it("due the following month, by digit or fixed day; weekends move to Monday", () => {
    const cal = remittanceCalendar(rows, "2026-10", { sss: 3, philhealth: null });
    expect(cal.map((d) => `${d.formCode} ${d.dueOn}${d.movedFromWeekend ? " (moved)" : ""}`)).toEqual(["SSS 2026-11-16 (moved)", "Pag-IBIG 2026-11-16 (moved)"]);
    expect(remittanceCalendar(rows, "2026-12", { sss: 1, philhealth: null }).map((d) => d.dueOn)).toEqual(["2027-01-11", "2027-01-15"]);
    expect(remittanceCalendar(rows, "2026-10", { sss: null, philhealth: null })[0].dueOn).toBeNull();
  });
});

describe("permit renewal planner (TO VERIFY)", () => {
  const p = { deadlines: [{ label: "Renew without surcharge", month: 1, day: 20 }] };
  it("points to this January until it passes or the permit is renewed", () => {
    expect(renewalPlan(p, null, "2026-01-05")).toMatchObject({ year: 2026, nextDeadline: { date: "2026-01-20", daysLeft: 15 } });
    expect(renewalPlan(p, null, "2026-11-19")).toMatchObject({ year: 2027, nextDeadline: { date: "2027-01-20" } });
    expect(renewalPlan(p, 2026, "2026-01-05")).toMatchObject({ year: 2027, renewedAlready: true });
  });
  it("validates LGU data shapes", () => {
    expect(lguStepsSchema.safeParse([{ title: "Get barangay clearance" }]).success).toBe(true);
    expect(lguFeesSchema.safeParse([{ label: "Mayor's permit fee", amount: null, note: "Based on gross sales" }]).success).toBe(true);
    expect(lguDeadlinesSchema.safeParse([{ label: "x", month: 13, day: 1 }]).success).toBe(false);
    expect(lguRequirementsSchema.safeParse([{ txt: "x" }]).success).toBe(false);
  });
});

describe("contribution rules are admin-validated like tax rules", () => {
  it("registers contribution parameter shapes", () => {
    expect(ruleParameterSchemas["contribution.sss"].safeParse({ mscMin: 5000 }).success).toBe(false);
    expect(ruleParameterSchemas["contribution.philhealth"].safeParse({ rate: 0.05, floor: 10000, ceiling: 100000, employeeShare: 0.5 }).success).toBe(true);
  });
});
