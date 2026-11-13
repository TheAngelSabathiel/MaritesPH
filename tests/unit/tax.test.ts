/**
 * Tax engine tests. ALL WORKED EXAMPLES ARE "TO VERIFY WITH CPA": the rule
 * parameters below are TEST FIXTURES shaped like the TRAIN-law tables, not
 * reviewed values. The engine reads every number from these rows.
 */
import { describe, expect, it } from "vitest";
import { decryptField, encryptField, parseKey } from "@/lib/crypto/fields";
import { compareOptions, filingCalendar, graduatedTax, quarterlyBreakdown, ruleOn, type RuleRow, type TaxInput } from "@/lib/engines/tax";

const rule = (key: string, parameters: unknown, from = "2023-01-01", to: string | null = null, cpa = true): RuleRow => ({
  id: `${key}@${from}`, rule_key: key, parameters, effective_from: from, effective_to: to, cpa_reviewed: cpa, source_url: "https://example.gov.ph/rule",
});
const RULES: RuleRow[] = [
  rule("income_tax.graduated", { brackets: [
    { over: 0, upTo: 250000, base: 0, rate: 0 }, { over: 250000, upTo: 400000, base: 0, rate: 0.15 }, { over: 400000, upTo: 800000, base: 22500, rate: 0.2 },
    { over: 800000, upTo: 2000000, base: 102500, rate: 0.25 }, { over: 2000000, upTo: 8000000, base: 402500, rate: 0.3 }, { over: 8000000, upTo: null, base: 2202500, rate: 0.35 },
  ] }),
  rule("income_tax.eight_percent", { rate: 0.08, exemptAmount: 250000, grossThreshold: 3000000 }),
  rule("income_tax.osd", { rate: 0.4 }),
  rule("percentage_tax.rate", { rate: 0.01 }, "2020-07-01", "2023-07-01"),
  rule("percentage_tax.rate", { rate: 0.03 }, "2023-07-01"),
];
const base: TaxInput = { year: 2026, grossReceipts: 0, otherIncome: 0, compensationIncome: 0, itemizedExpenses: 0, deductionMethod: "osd", vatRegistered: false };

describe("field encryption", () => {
  const key = parseKey(Buffer.alloc(32, 7).toString("base64"))!;
  it("round-trips, uses a fresh IV, and detects tampering or a wrong key", () => {
    const a = encryptField("123-456-789-000", key);
    expect(a).toMatch(/^v1:/);
    expect(encryptField("123-456-789-000", key)).not.toBe(a);
    expect(decryptField(a, key)).toBe("123-456-789-000");
    const tampered = a.slice(0, -4) + (a.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(decryptField(tampered, key)).toBeNull();
    expect(decryptField(a, parseKey(Buffer.alloc(32, 9).toString("base64"))!)).toBeNull();
    expect(parseKey("too-short")).toBeNull();
  });
});

describe("effective-dated rules", () => {
  it("picks the version in force", () => {
    expect((ruleOn(RULES, "percentage_tax.rate", "2023-06-30")?.parameters as { rate: number }).rate).toBe(0.01);
    expect((ruleOn(RULES, "percentage_tax.rate", "2023-07-01")?.parameters as { rate: number }).rate).toBe(0.03);
    expect(ruleOn(RULES, "percentage_tax.rate", "2019-01-01")).toBeNull();
  });
  it("refuses to compute without every rule (no hidden defaults)", () => {
    expect(compareOptions({ ...base, grossReceipts: 1 }, RULES.filter((r) => r.rule_key !== "income_tax.osd"))).toEqual({ status: "missing_rules", missing: ["income_tax.osd"] });
    expect(compareOptions({ ...base, grossReceipts: 1 }, [...RULES.filter((r) => r.rule_key !== "income_tax.osd"), rule("income_tax.osd", { rate: "40%" })])).toMatchObject({ status: "missing_rules" });
  });
});

describe("8% vs graduated (TO VERIFY WITH CPA)", () => {
  it("graduated table", () => {
    expect(graduatedTax(250000, (RULES[0].parameters as { brackets: never }).brackets)).toBe(0);
    expect(graduatedTax(600000, (RULES[0].parameters as { brackets: never }).brackets)).toBe(62500);
  });

  it("₱1,000,000 gross, purely self-employed, OSD: 8% (₱60,000) beats graduated (₱62,500 + ₱30,000)", () => {
    const r = compareOptions({ ...base, grossReceipts: 1_000_000 }, RULES);
    expect(r).toMatchObject({
      status: "ok",
      eightPercent: { eligible: true, incomeTax: 60000, total: 60000 },
      graduated: { deduction: 400000, taxableIncome: 600000, incomeTax: 62500, percentageTax: 30000, total: 92500 },
      recommended: "eight_percent",
      difference: 32500,
      allCpaReviewed: true,
    });
    if (r.status === "ok") expect(r.rulesUsed.map((u) => u.key)).toEqual(["income_tax.graduated", "income_tax.eight_percent", "income_tax.osd", "percentage_tax.rate"]);
  });

  it("₱500,000 gross with ₱300,000 itemized expenses: graduated wins", () => {
    const r = compareOptions({ ...base, grossReceipts: 500_000, itemizedExpenses: 300_000, deductionMethod: "itemized" }, RULES);
    expect(r).toMatchObject({ eightPercent: { total: 20000 }, graduated: { taxableIncome: 200000, incomeTax: 0, percentageTax: 15000, total: 15000 }, recommended: "graduated", difference: 5000 });
  });

  it("mixed income: no ₱250,000 exemption under 8%; compensation taxed on the table", () => {
    const r = compareOptions({ ...base, grossReceipts: 600_000, compensationIncome: 400_000 }, RULES);
    expect(r).toMatchObject({ eightPercent: { total: 70500 }, graduated: { taxableIncome: 760000, incomeTax: 94500, percentageTax: 18000, total: 112500 }, recommended: "eight_percent" });
  });

  it("8% isn't available above the threshold or when VAT-registered", () => {
    expect(compareOptions({ ...base, grossReceipts: 3_500_000 }, RULES)).toMatchObject({ eightPercent: { eligible: false, reason: "over_threshold" }, recommended: "graduated" });
    expect(compareOptions({ ...base, grossReceipts: 900_000, vatRegistered: true }, RULES)).toMatchObject({ eightPercent: { eligible: false, reason: "vat_registered" }, graduated: { percentageTax: 0 } });
  });

  it("flags results that use rules a CPA hasn't reviewed", () => {
    const unreviewed = RULES.map((r) => (r.rule_key === "income_tax.osd" ? { ...r, cpa_reviewed: false } : r));
    expect(compareOptions({ ...base, grossReceipts: 1 }, unreviewed)).toMatchObject({ allCpaReviewed: false });
  });
});

describe("quarterly breakdown (TO VERIFY WITH CPA)", () => {
  it("8%: cumulative, exempt amount first, minus earlier payments", () => {
    const r = quarterlyBreakdown("eight_percent", [{ gross: 250000, expenses: 0 }, { gross: 250000, expenses: 0 }, { gross: 250000, expenses: 0 }], base, RULES);
    expect(r).toEqual({ status: "ok", lines: [
      { quarter: 1, cumulativeGross: 250000, incomeTaxDue: 0, percentageTax: 0 },
      { quarter: 2, cumulativeGross: 500000, incomeTaxDue: 20000, percentageTax: 0 },
      { quarter: 3, cumulativeGross: 750000, incomeTaxDue: 20000, percentageTax: 0 },
    ] });
  });
  it("graduated with OSD, plus quarterly percentage tax", () => {
    const r = quarterlyBreakdown("graduated", [{ gross: 500000, expenses: 0 }, { gross: 500000, expenses: 0 }, { gross: 0, expenses: 0 }], base, RULES);
    expect(r).toMatchObject({ lines: [
      { quarter: 1, incomeTaxDue: 7500, percentageTax: 15000 },   // 300,000 taxable
      { quarter: 2, incomeTaxDue: 55000, percentageTax: 15000 },  // 600,000 taxable -> 62,500 total
      { quarter: 3, incomeTaxDue: 0, percentageTax: 0 },
    ] });
  });
});

describe("filing calendar (TO VERIFY WITH CPA)", () => {
  const row = (form: string, due_rule: unknown, applies_to: string[]) => ({ id: form, form_code: form, frequency: "quarterly", due_rule, applies_to, description: null, effective_from: "2023-01-01", effective_to: null, cpa_reviewed: true, source_url: null });
  const rows = [
    row("1701Q", { kind: "quarterly_fixed", dates: [{ quarter: 1, month: 5, day: 15 }, { quarter: 2, month: 8, day: 15 }, { quarter: 3, month: 11, day: 15 }] }, ["all"]),
    row("2551Q", { kind: "after_quarter_end", days: 25 }, ["graduated"]),
    row("1701A", { kind: "annual_fixed", month: 4, day: 15, yearOffset: 1 }, ["all"]),
    row("BROKEN", { kind: "whenever" }, ["all"]),
  ];
  it("builds dates, moves weekends to Monday, and filters by tax option", () => {
    const eight = filingCalendar(rows, 2026, "eight_percent");
    expect(eight.map((d) => `${d.formCode} ${d.period} ${d.dueOn}${d.movedFromWeekend ? " (moved)" : ""}`)).toEqual([
      "1701Q Q1 2026-05-15", "1701Q Q2 2026-08-17 (moved)", "1701Q Q3 2026-11-16 (moved)", "1701A Annual 2027-04-15",
    ]);
    const grad = filingCalendar(rows, 2026, "graduated").filter((d) => d.formCode === "2551Q").map((d) => d.dueOn);
    expect(grad).toEqual(["2026-04-27", "2026-07-27", "2026-10-26", "2027-01-25"]);
  });
});
