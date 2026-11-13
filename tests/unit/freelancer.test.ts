import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRecordForm } from "@/lib/admin/form";
import { resources } from "@/lib/admin/resources";
import { dueRuleSchema, filingCalendar, ruleParameterSchemas, type DeadlineRow } from "@/lib/engines/tax";
import { quarterTotals } from "@/lib/freelancer/data";
import { reminderEmail, remindersDue } from "@/lib/freelancer/reminders";
import { pickYear } from "@/lib/freelancer/year";

describe("seeded tax rules and deadlines match the engine's expectations", () => {
  const seed = readFileSync("supabase/seed.sql", "utf8");
  it("every seeded rule's parameters validate for its key", () => {
    const rules = [...seed.matchAll(/\('(income_tax\.[a-z_]+|percentage_tax\.rate|contribution\.[a-z]+)',\s*'[^']*',\s*'(\{[^']+\})'/g)];
    expect(rules.length).toBe(8);
    for (const [, key, json] of rules) expect(ruleParameterSchemas[key].safeParse(JSON.parse(json)).success, key).toBe(true);
  });
  it("every seeded deadline rule is understood", () => {
    const deadlines = [...seed.matchAll(/\('(1701Q|2551Q|1701|SSS|PhilHealth|Pag-IBIG)',\s*'[a-z]+',\s*'(\{[^']+\})'/g)];
    expect(deadlines.length).toBe(6);
    for (const [, form, json] of deadlines) expect(dueRuleSchema.safeParse(JSON.parse(json)).success, form).toBe(true);
  });
});

describe("admin JSON fields", () => {
  const get = (d: Record<string, string>) => (n: string) => d[n] ?? null;
  it("parses and validates tax rule parameters per key", () => {
    const ok = parseRecordForm(resources.tax_rule, get({ rule_key: "percentage_tax.rate", description: "Rate", parameters: '{"rate": 0.03}', effective_from: "2023-07-01" }));
    expect(ok.ok && ok.values.parameters).toEqual({ rate: 0.03 });
    const badJson = parseRecordForm(resources.tax_rule, get({ rule_key: "percentage_tax.rate", description: "Rate", parameters: "{rate: 3%}", effective_from: "2023-07-01" }));
    expect(!badJson.ok && badJson.errors.parameters).toBeTruthy();
    const wrongShape = parseRecordForm(resources.tax_rule, get({ rule_key: "percentage_tax.rate", description: "Rate", parameters: '{"rate": "3%"}', effective_from: "2023-07-01" }));
    expect(!wrongShape.ok && wrongShape.errors.parameters).toMatch(/expected shape/);
    const badDeadline = parseRecordForm(resources.tax_deadline, get({ form_code: "1701Q", frequency: "quarterly", due_rule: '{"kind":"whenever"}', applies_to: "all", effective_from: "2023-01-01" }));
    expect(!badDeadline.ok && badDeadline.errors.due_rule).toBeTruthy();
  });
});

describe("freelancer helpers", () => {
  it("picks a sensible year", () => {
    const now = new Date("2026-12-31T20:00:00Z"); // Jan 1 2027 in Manila
    expect(pickYear(undefined, now)).toBe(2027);
    expect(pickYear("2025", now)).toBe(2025);
    expect(pickYear("1999", now)).toBe(2027);
    expect(pickYear("abc", now)).toBe(2027);
  });
  it("totals entries per quarter", () => {
    expect(quarterTotals([{ date: "2026-01-10", php_amount: 100 }, { date: "2026-03-31", php_amount: 50.5 }, { date: "2026-04-01", php_amount: 1 }, { date: "2026-12-31", php_amount: 2 }])).toEqual([150.5, 1, 0, 2]);
  });
  it("plans reminders within the window and never after the due date", () => {
    const rows: DeadlineRow[] = [{ id: "a", form_code: "1701Q", frequency: "quarterly", due_rule: { kind: "quarterly_fixed", dates: [{ quarter: 1, month: 5, day: 15 }] }, applies_to: ["all"], description: null, effective_from: "2023-01-01", effective_to: null, cpa_reviewed: true, source_url: null }];
    const cal = filingCalendar(rows, 2026, "eight_percent");
    expect(remindersDue(cal, "2026-05-07", 7)).toHaveLength(0);
    expect(remindersDue(cal, "2026-05-08", 7).map((d) => d.key)).toEqual(["1701Q:2026:Q1"]);
    expect(remindersDue(cal, "2026-05-16", 7)).toHaveLength(0);
  });
  it("reminder emails carry no financial data", () => {
    const cal = filingCalendar([{ id: "a", form_code: "1701Q", frequency: "quarterly", due_rule: { kind: "quarterly_fixed", dates: [{ quarter: 1, month: 5, day: 15 }] }, applies_to: ["all"], description: null, effective_from: "2023-01-01", effective_to: null, cpa_reviewed: true, source_url: null }], 2026, "graduated");
    const m = reminderEmail(cal[0], "fil", "https://maritesph.example");
    expect(m.subject).toContain("1701Q");
    expect(m.text).toContain("https://maritesph.example/fil/freelancer/calendar");
    expect(m.text).not.toMatch(/₱|\bPHP\b/);
  });
});

describe("seeded LGU processes parse", async () => {
  const { lguDeadlinesSchema, lguFeesSchema, lguRequirementsSchema, lguStepsSchema } = await import("@/lib/engines/lgu");
  it("every seeded city row has valid JSON lists", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");
    const rows = [...seed.matchAll(/'business_permit_renewal', '[^']*(?:''[^']*)*',\s*'(\[[\s\S]*?\])',\s*'(\[[\s\S]*?\])',\s*'(\[[\s\S]*?\])',\s*'(\[[\s\S]*?\])'/g)];
    expect(rows.length).toBe(3);
    for (const [, steps, reqs, fees, deadlines] of rows) {
      const j = (x: string) => JSON.parse(x.replace(/''/g, "'"));
      expect(lguStepsSchema.safeParse(j(steps)).success).toBe(true);
      expect(lguRequirementsSchema.safeParse(j(reqs)).success).toBe(true);
      expect(lguFeesSchema.safeParse(j(fees)).success).toBe(true);
      expect(lguDeadlinesSchema.safeParse(j(deadlines)).success).toBe(true);
    }
  });
});
