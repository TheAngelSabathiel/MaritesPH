import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";
import {
  agencySlug,
  citySlug,
  distanceKm,
  filterOffices,
  formatAddress,
  formatTime,
  manilaClock,
  officePath,
  openStatus,
  sortByDistance,
  type PublicOffice,
} from "@/lib/content/offices";
import { breadcrumbList, governmentOffice, howTo, jsonLdString } from "@/lib/seo/structured-data";
import { reportSchema } from "@/lib/report/schema";
import { feeDisplay, formatPeso } from "@/lib/format";

describe("slugify (mirrors SQL public.slugify)", () => {
  it("matches the database cases", () => {
    expect(slugify("Parañaque City Hall")).toBe("paranaque-city-hall");
    expect(slugify("  DFA (ASEANA) — Office #1 ")).toBe("dfa-aseana-office-1");
    expect(slugify(null)).toBe("");
  });
});

const office = (over: Partial<PublicOffice>): PublicOffice => ({
  id: "1",
  slug: "main",
  name: "Main Office",
  address: "1 Street",
  region: "NCR",
  province: null,
  city: "Quezon City",
  barangay: null,
  lat: 14.65,
  lng: 121.05,
  hours: { mon: [["08:00", "17:00"]] },
  hoursNote: null,
  acceptsWalkIn: null,
  appointmentUrl: null,
  sourceUrl: null,
  lastVerifiedAt: null,
  agency: { id: "a", name: "Philippine Statistics Authority", acronym: "PSA" },
  documents: [{ id: "d", slug: "psa-birth-certificate", name: "PSA Birth Certificate" }],
  ...over,
});

describe("office paths and filters", () => {
  it("builds clean URLs", () => {
    expect(officePath("fil", office({}))).toBe("/fil/offices/quezon-city/psa/main");
    expect(citySlug(null)).toBe("unknown");
    expect(agencySlug({ name: "Sample Agency", acronym: null })).toBe("sample-agency");
  });

  const list = [
    office({ id: "1", name: "Weekday Office" }),
    office({ id: "2", name: "Saturday Office", hours: { sat: [["08:00", "12:00"]] }, acceptsWalkIn: true, city: "Manila" }),
    office({ id: "3", name: "Other Agency", agency: { id: "b", name: "Department of Foreign Affairs", acronym: "DFA" }, documents: [] }),
  ];

  it("filters by weekend, walk-in, city, agency, document, and text", () => {
    expect(filterOffices(list, { weekend: true }).map((o) => o.id)).toEqual(["2"]);
    expect(filterOffices(list, { walkIn: true }).map((o) => o.id)).toEqual(["2"]);
    expect(filterOffices(list, { city: "manila" }).map((o) => o.id)).toEqual(["2"]);
    expect(filterOffices(list, { agency: "dfa" }).map((o) => o.id)).toEqual(["3"]);
    expect(filterOffices(list, { document: "psa-birth-certificate" }).map((o) => o.id)).toEqual(["1", "2"]);
    expect(filterOffices(list, { query: "foreign affairs" }).map((o) => o.id)).toEqual(["3"]);
    expect(filterOffices(list, {}).length).toBe(3);
  });
});

describe("distance", () => {
  it("computes great-circle distance and sorts, unknown last", () => {
    // Manila City Hall to Quezon City Hall is roughly 10 km.
    const d = distanceKm({ lat: 14.5896, lng: 120.9811 }, { lat: 14.6466, lng: 121.0493 });
    expect(d).toBeGreaterThan(8);
    expect(d).toBeLessThan(12);
    const sorted = sortByDistance(
      [{ id: "far", lat: 15, lng: 121 }, { id: "none", lat: null, lng: null }, { id: "near", lat: 14.6, lng: 121 }],
      { lat: 14.6, lng: 121 },
    );
    expect(sorted.map((o) => o.id)).toEqual(["near", "far", "none"]);
  });
});

describe("open status in Manila time", () => {
  const hours = { mon: [["08:00", "12:00"], ["13:00", "17:00"]] as [string, string][], sat: [["08:00", "12:00"]] as [string, string][] };
  // 2026-11-16 is a Monday. 02:00Z = 10:00 in Manila.
  it("reads the Manila clock", () => {
    expect(manilaClock(new Date("2026-11-16T02:00:00Z"))).toEqual({ day: "mon", minutes: 600 });
    // 17:00Z Sunday = 01:00 Monday in Manila.
    expect(manilaClock(new Date("2026-11-15T17:00:00Z")).day).toBe("mon");
  });
  it("knows open, lunch break, after hours, and next day", () => {
    expect(openStatus(hours, new Date("2026-11-16T02:00:00Z"))).toEqual({ open: true, closesAt: "12:00" });
    expect(openStatus(hours, new Date("2026-11-16T04:30:00Z"))).toEqual({ open: false, opensAt: { day: "mon", time: "13:00", today: true } });
    expect(openStatus(hours, new Date("2026-11-16T10:00:00Z"))).toEqual({ open: false, opensAt: { day: "sat", time: "08:00", today: false } });
    expect(openStatus({}, new Date("2026-11-16T02:00:00Z"))).toEqual({ open: false, opensAt: null });
  });
  it("formats 12-hour times", () => {
    expect(formatTime("13:30")).toBe("1:30 PM");
    expect(formatTime("00:05")).toBe("12:05 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
  });
});

describe("structured data", () => {
  it("builds HowTo with total time and cost", () => {
    const data = howTo({
      name: "Sample ID",
      description: null,
      url: "https://x.ph/en/ids/sample-id",
      inLanguage: "en-PH",
      steps: [{ title: "A", body: "", estimatedMinutes: 15 }, { title: "B", body: "Do B", estimatedMinutes: 30 }],
      supplies: ["Form"],
      feeMin: 100,
      dateModified: null,
    });
    expect(data.totalTime).toBe("PT45M");
    expect(data.estimatedCost).toEqual({ "@type": "MonetaryAmount", currency: "PHP", value: 100 });
    expect(data.step[0]).toMatchObject({ position: 1, text: "A", url: "https://x.ph/en/ids/sample-id#step-1" });
    expect("description" in data).toBe(false);
  });
  it("builds breadcrumbs and office hours", () => {
    expect(breadcrumbList([{ name: "Home", url: "u" }]).itemListElement[0]).toEqual({ "@type": "ListItem", position: 1, name: "Home", item: "u" });
    const o = governmentOffice({ name: "O", url: "u", address: null, city: "Manila", region: null, lat: 1, lng: 2, hours: { sat: [["08:00", "12:00"]] } });
    expect(o.openingHoursSpecification).toEqual([{ "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Saturday", opens: "08:00", closes: "12:00" }]);
  });
  it("escapes </script> in JSON-LD", () => {
    expect(jsonLdString({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});


describe("report schema", () => {
  const base = { target_type: "document", target_id: "d0000000-0000-0000-0000-000000000001", reason: "outdated", details: "Fee changed" };
  it("accepts a valid report with or without evidence", () => {
    expect(reportSchema.safeParse(base).success).toBe(true);
    expect(reportSchema.safeParse({ ...base, evidence_url: "" }).success).toBe(true);
    expect(reportSchema.safeParse({ ...base, evidence_url: "https://dfa.gov.ph/advisory" }).success).toBe(true);
  });
  it("rejects bad reasons, tiny details, non-http links, and unknown targets", () => {
    expect(reportSchema.safeParse({ ...base, reason: "spam" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...base, details: "bad" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...base, evidence_url: "javascript:alert(1)" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...base, target_type: "profile" }).success).toBe(false);
  });
});

describe("formatAddress", () => {
  it("doesn't repeat parts already in the address", () => {
    expect(formatAddress("123 Sample Street, Sample City", "Sample Barangay", "Sample City")).toBe("123 Sample Street, Sample City, Sample Barangay");
    expect(formatAddress("Taft Avenue", "Ermita", "Manila")).toBe("Taft Avenue, Ermita, Manila");
    expect(formatAddress(null, null, "Manila")).toBe("Manila");
  });
});

describe("peso formatting", () => {
  it("formats amounts and ranges", () => {
    expect(formatPeso(1200)).toBe("₱1,200");
    expect(formatPeso(130.5)).toBe("₱130.50");
    expect(feeDisplay(0, 0)).toEqual({ kind: "free" });
    expect(feeDisplay(null, null)).toEqual({ kind: "unknown" });
    expect(feeDisplay(130, null)).toEqual({ kind: "amount", text: "₱130" });
    expect(feeDisplay(950, 1200)).toEqual({ kind: "range", min: "₱950", max: "₱1,200" });
  });
});
