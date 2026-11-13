import { describe, expect, it } from "vitest";
import { hasWeekendHours, hoursFromFields, hoursSchema } from "@/lib/content/hours";
import { groupRequirements, humanizeKey, satisfiesRequirements, type RequirementRow } from "@/lib/content/requirements";

describe("hoursSchema", () => {
  it("accepts a normal week", () => {
    expect(hoursSchema.safeParse({ mon: [["08:00", "17:00"]], sat: [["08:00", "12:00"]], sun: [] }).success).toBe(true);
  });
  it("rejects bad times, reversed and overlapping intervals, unknown days", () => {
    expect(hoursSchema.safeParse({ mon: [["8:00", "17:00"]] }).success).toBe(false);
    expect(hoursSchema.safeParse({ mon: [["17:00", "08:00"]] }).success).toBe(false);
    expect(hoursSchema.safeParse({ mon: [["08:00", "12:00"], ["11:00", "17:00"]] }).success).toBe(false);
    expect(hoursSchema.safeParse({ funday: [] }).success).toBe(false);
  });
  it("detects weekend hours", () => {
    expect(hasWeekendHours({ sat: [["08:00", "12:00"]] })).toBe(true);
    expect(hasWeekendHours({ mon: [["08:00", "17:00"]], sat: [] })).toBe(false);
  });
});

describe("hoursFromFields", () => {
  it("builds intervals from form fields, empty = closed", () => {
    const fields: Record<string, string> = { mon_open: "08:00", mon_close: "12:00", mon_open2: "13:00", mon_close2: "17:00" };
    const out = hoursFromFields((n) => fields[n] ?? "") as Record<string, unknown>;
    expect(out.mon).toEqual([["08:00", "12:00"], ["13:00", "17:00"]]);
    expect(out.sun).toEqual([]);
    expect(hoursSchema.safeParse(out).success).toBe(true);
  });
  it("keeps half-filled intervals so validation can report them", () => {
    const out = hoursFromFields((n) => (n === "tue_open" ? "08:00" : "")) as Record<string, unknown>;
    expect(out.tue).toEqual([["08:00", ""]]);
    expect(hoursSchema.safeParse(out).success).toBe(false);
  });
});

const row = (id: string, group_key: string, option_key: string, sort_order: number, doc: string | null): RequirementRow => ({
  id,
  group_key,
  option_key,
  sort_order,
  requires_document_id: doc,
  requirement_text: doc ? null : `text ${id}`,
});

describe("groupRequirements", () => {
  // "valid_id: passport, OR birth certificate + photo ID" plus "appointment"
  const rows = [
    row("3", "valid_id", "b", 21, null),
    row("1", "appointment", "a", 10, null),
    row("2", "valid_id", "b", 20, "birth-cert"),
    row("4", "valid_id", "a", 15, "passport"),
  ];

  it("groups by group then option, ordered", () => {
    const groups = groupRequirements(rows);
    expect(groups.map((g) => g.groupKey)).toEqual(["appointment", "valid_id"]);
    expect(groups[1].options.map((o) => [o.optionKey, o.items.map((i) => i.id)])).toEqual([
      ["a", ["4"]],
      ["b", ["2", "3"]],
    ]);
  });

  it("checks AND/OR satisfaction", () => {
    const groups = groupRequirements(rows);
    const have = (ids: string[]) => (item: RequirementRow) => ids.includes(item.id);
    expect(satisfiesRequirements(groups, have(["1", "4"]))).toEqual({ ok: true, missingGroups: [] });
    expect(satisfiesRequirements(groups, have(["1", "2", "3"])).ok).toBe(true);
    expect(satisfiesRequirements(groups, have(["1", "2"]))).toEqual({ ok: false, missingGroups: ["valid_id"] });
  });

  it("humanizes keys", () => {
    expect(humanizeKey("proof_of_address")).toBe("Proof of address");
  });
});
