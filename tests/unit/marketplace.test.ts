import { describe, expect, it } from "vitest";
import { filterDirectory, platformFee, screenText, type DirectoryEntry } from "@/lib/marketplace/rules";

const entry = (over: Partial<DirectoryEntry>): DirectoryEntry => ({
  user_id: "u", display_name: "Ana", profession: "cpa", prc_license_no: "0123456", license_valid_until: null, firm_name: null, bio: null,
  services: ["tax_filing"], cities: ["Quezon City"], online_only: false, starting_fee_php: null, verified_at: "2026-11-20T00:00:00Z", rating_avg: null, rating_count: 0, ...over,
});

describe("marketplace rules", () => {
  it("computes the platform fee", () => {
    expect(platformFee(3500, 0.1)).toBe(350);
    expect(platformFee(1999.99, 0.075)).toBe(150);
    expect(platformFee(5000, 0)).toBe(0);
  });
  it("keeps contact details out of messages, bios, and reviews", () => {
    expect(screenText("Please help me file my 1701Q for Q3, I'm a freelance designer.")).toBe("ok");
    expect(screenText("Text me at 0917 123 4567")).toBe("contact_details");
    expect(screenText("Email me: ana@example.com")).toBe("contact_details");
    expect(screenText("Message me on facebook.com/ana.cpa")).toBe("contact_details");
  });
  it("filters by service and city; online professionals match any city", () => {
    const list = [entry({ user_id: "a" }), entry({ user_id: "b", services: ["payroll"], cities: ["Manila"] }), entry({ user_id: "c", cities: [], online_only: true })];
    expect(filterDirectory(list, { service: "tax_filing" }).map((e) => e.user_id)).toEqual(["a", "c"]);
    expect(filterDirectory(list, { city: "manila" }).map((e) => e.user_id)).toEqual(["b", "c"]);
    expect(filterDirectory(list, { service: "payroll", city: "Quezon City" }).map((e) => e.user_id)).toEqual([]);
  });
});
