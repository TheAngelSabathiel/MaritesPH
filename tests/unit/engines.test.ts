import { describe, expect, it } from "vitest";
import { findPaths, visitsFor } from "@/lib/engines/dependencies";
import { freeTimeSlots, rankOffices } from "@/lib/engines/offices";
import { buildPlan, freeWindowsFor, type PlannerInput } from "@/lib/engines/planner";
import type { Catalog, CatalogDocument, CatalogRequirementItem } from "@/lib/engines/types";
import type { PublicOffice } from "@/lib/content/offices";
import en from "@/i18n/messages/en.json";
import { officeReasonText, riskText, travelText, whenText } from "@/lib/planner/describe";

const NOW = new Date("2026-11-16T02:00:00Z"); // Monday 10:00 in Manila
let rid = 0;
const req = (groupKey: string, optionKey: string, doc: string | null, text: string | null = null): CatalogRequirementItem => ({
  id: `r${++rid}`, groupKey, optionKey, documentId: doc, text, quantity: 1,
});
const doc = (id: string, over: Partial<CatalogDocument>): CatalogDocument => ({
  id, slug: id, name: id.toUpperCase(), agencyName: null, feeMin: 0, feeMax: 0, processingDaysMin: 1, processingDaysMax: 1,
  purposes: [], requirements: [], steps: [{ id: `${id}-s1`, isOnline: false }], lastVerifiedAt: "2026-11-01T00:00:00Z", ...over,
});
const office = (id: string, over: Partial<PublicOffice>): PublicOffice => ({
  id, slug: id, name: `Office ${id}`, address: null, region: "NCR", province: null, city: "Manila", barangay: null,
  lat: 14.6, lng: 121.0, hours: { mon: [["08:00", "17:00"]], tue: [["08:00", "17:00"]], wed: [["08:00", "17:00"]], thu: [["08:00", "17:00"]], fri: [["08:00", "17:00"]] },
  hoursNote: null, acceptsWalkIn: null, appointmentUrl: null, sourceUrl: null, lastVerifiedAt: "2026-11-01T00:00:00Z",
  agency: { id: "a", name: "Agency", acronym: "AG" }, documents: [], ...over,
});

const documents: CatalogDocument[] = [
  doc("bc", { feeMin: 155, feeMax: 365, processingDaysMin: 1, processingDaysMax: 3, purposes: ["proof_of_identity"] }),
  doc("natid", {
    feeMin: 0, feeMax: 0, processingDaysMin: 30, processingDaysMax: 90, purposes: ["bank_account"],
    requirements: [req("proof", "a", "passport"), req("proof", "b", "bc"), req("proof", "b", null, "Photo ID")],
  }),
  doc("passport", {
    feeMin: 950, feeMax: 1200, processingDaysMin: 6, processingDaysMax: 12, purposes: ["bank_account", "travel_abroad"],
    requirements: [req("birth", "a", "bc"), req("id", "a", "natid"), req("id", "b", "postal"), req("id", "c", null, "Other government ID")],
  }),
  doc("postal", {
    feeMin: null, feeMax: null, processingDaysMin: null, processingDaysMax: null,
    requirements: [req("identity", "a", "bc"), req("identity", "b", "natid"), req("identity", "c", "passport"), req("address", "a", null, "Proof of address")],
  }),
  doc("loopa", { requirements: [req("g", "a", "loopb")] }),
  doc("loopb", { requirements: [req("g", "a", "loopa")] }),
  doc("online", { steps: [{ id: "o1", isOnline: true }, { id: "o2", isOnline: true }] }),
  doc("needs_unpublished", { requirements: [req("g", "a", "not_in_catalog")] }),
];

const weekday = office("weekday", { documents: [{ id: "bc", slug: "bc", name: "BC" }, { id: "natid", slug: "natid", name: "N" }, { id: "passport", slug: "passport", name: "P" }], acceptsWalkIn: true });
const saturday = office("saturday", {
  lat: 14.7, lng: 121.05, acceptsWalkIn: false,
  hours: { mon: [["08:00", "17:00"]], sat: [["08:00", "12:00"]] },
  documents: [{ id: "bc", slug: "bc", name: "BC" }, { id: "passport", slug: "passport", name: "P" }],
});
const catalog: Catalog = { documents, offices: [weekday, saturday] };

describe("dependency engine", () => {
  it("is already satisfied when the person has the goal document", () => {
    expect(findPaths(catalog, { kind: "document", documentId: "passport" }, new Set(["passport"]))).toEqual({ status: "already_satisfied", satisfiedBy: ["passport"] });
  });

  it("finds the easiest path, with prerequisites first and free-text items to prepare", () => {
    const r = findPaths(catalog, { kind: "document", documentId: "passport" }, new Set());
    expect(r.status).toBe("paths");
    if (r.status !== "paths") return;
    const best = r.paths[0];
    expect(best.acquire).toEqual(["bc", "passport"]);
    expect(best.prepare.map((p) => p.text)).toEqual(["Other government ID"]);
    expect(best.prereqs.passport).toEqual(["bc"]);
    expect(best.visits).toBe(2);
    expect(best.cost).toEqual({ min: 155 + 950, max: 365 + 1200 });
    expect(best.days).toEqual({ min: 1 + 6, max: 3 + 12 }); // sequential: birth certificate first
    expect(r.paths.length).toBeGreaterThan(1);
  });

  it("breaks 'need an ID to get an ID' loops by taking the other option", () => {
    // natid's option a needs a passport, whose ID group can need natid: the engine must use option b.
    const r = findPaths(catalog, { kind: "document", documentId: "natid" }, new Set());
    if (r.status !== "paths") throw new Error("expected paths");
    expect(r.paths[0].acquire).toEqual(["bc", "natid"]);
    for (const p of r.paths) expect(new Set(p.acquire).size).toBe(p.acquire.length);
  });

  it("uses what the person already has", () => {
    const r = findPaths(catalog, { kind: "document", documentId: "natid" }, new Set(["passport"]));
    if (r.status !== "paths") throw new Error("expected paths");
    expect(r.paths[0].acquire).toEqual(["natid"]);
    expect(r.paths[0].prepare).toEqual([]);
  });

  it("flags unknown fees and processing time", () => {
    const r = findPaths(catalog, { kind: "document", documentId: "postal" }, new Set(["bc"]));
    if (r.status !== "paths") throw new Error("expected paths");
    expect(r.paths[0]).toMatchObject({ acquire: ["postal"], costUnknown: true, daysUnknown: true });
    expect(r.paths[0].prepare.map((p) => p.text)).toEqual(["Proof of address"]);
  });

  it("is blocked by pure loops and unpublished prerequisites", () => {
    expect(findPaths(catalog, { kind: "document", documentId: "loopa" }, new Set())).toMatchObject({ status: "blocked", reason: "unreachable" });
    expect(findPaths(catalog, { kind: "document", documentId: "needs_unpublished" }, new Set())).toMatchObject({ status: "blocked" });
  });

  it("handles purpose goals across candidate documents", () => {
    const r = findPaths(catalog, { kind: "purpose", purpose: "bank_account" }, new Set());
    if (r.status !== "paths") throw new Error("expected paths");
    expect(r.paths[0].target).toBe("natid"); // same visits as passport, but cheaper
    expect(findPaths(catalog, { kind: "purpose", purpose: "bank_account" }, new Set(["natid"]))).toMatchObject({ status: "already_satisfied" });
    expect(findPaths(catalog, { kind: "purpose", purpose: "nothing" }, new Set())).toMatchObject({ status: "blocked", reason: "no_candidates" });
  });

  it("counts no visit for fully online documents", () => {
    expect(visitsFor(documents.find((d) => d.id === "online")!)).toBe(0);
    expect(visitsFor(doc("nosteps", { steps: [] }))).toBe(1);
  });
});

describe("office ranking", () => {
  const free8to5 = freeWindowsFor({ preset: "office_8to5" });

  it("finds opening hours that overlap free time", () => {
    expect(freeTimeSlots(saturday, free8to5)).toEqual([{ day: "sat", start: "08:00", end: "12:00" }]);
    expect(freeTimeSlots(weekday, free8to5)).toEqual([]); // 8-to-5 worker can't reach a 8-to-5 office
    expect(freeTimeSlots(weekday, freeWindowsFor({ preset: "night_shift" }))[0]).toEqual({ day: "mon", start: "13:00", end: "17:00" });
  });

  it("prefers offices open during free time over nearer ones, with reasons", () => {
    const ranked = rankOffices({ offices: catalog.offices, documentId: "passport", origin: { lat: 14.6, lng: 121.0 }, freeWindows: free8to5, transport: "commute", staleDays: 90, now: NOW });
    expect(ranked.map((r) => r.office.id)).toEqual(["saturday", "weekday"]);
    expect(ranked[0].reasons).toEqual(expect.arrayContaining([{ code: "open_in_free_time", day: "sat", start: "08:00", end: "12:00" }, { code: "appointment_needed" }, { code: "weekend_hours" }]));
    expect(ranked[1].reasons).toEqual(expect.arrayContaining([{ code: "near", km: 0 }, { code: "not_open_in_free_time" }, { code: "walk_in" }]));
    expect(ranked[0].travelMinutes).toBeGreaterThan(0);
  });

  it("penalizes stale data and long waits, and only lists offices for the document", () => {
    const stale = office("stale", { lastVerifiedAt: "2026-01-01T00:00:00Z", documents: [{ id: "bc", slug: "bc", name: "BC" }] });
    const fresh = office("fresh", { documents: [{ id: "bc", slug: "bc", name: "BC" }] });
    const ranked = rankOffices({ offices: [stale, fresh, saturday], documentId: "bc", freeWindows: [], transport: "walk", staleDays: 90, now: NOW, waitMinutes: { fresh: 90 } });
    expect(ranked.find((r) => r.office.id === "stale")!.reasons).toContainEqual(expect.objectContaining({ code: "stale" }));
    expect(ranked.find((r) => r.office.id === "fresh")!.reasons).toContainEqual({ code: "long_wait", minutes: 90 });
    expect(rankOffices({ offices: [stale], documentId: "passport", freeWindows: [], transport: "walk", staleDays: 90, now: NOW })).toEqual([]);
  });
});

describe("planner (Mga Diskarte)", () => {
  const base: PlannerInput = {
    goal: { kind: "document", documentId: "passport" }, have: [], origin: { lat: 14.6, lng: 121.0 },
    schedule: { preset: "office_8to5" }, leaveDays: 0, urgency: "no_rush", budget: null, transport: "commute",
  };
  const ctx = { now: NOW, staleDays: 90 };

  it("merges into one option when every strategy agrees", () => {
    const r = buildPlan(catalog, base, ctx);
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.options).toHaveLength(1);
    expect(r.reasons).toEqual([{ code: "best_on_every_count" }]);
  });

  it("recommends the no-leave option for an 8-to-5 worker without leave", () => {
    // A far Saturday office vs. a near weekday-only office: "fastest" picks the near one
    // (needs leave); "no leave" picks the Saturday one.
    const farSaturday = { ...saturday, lat: 14.9, lng: 121.3 };
    const r = buildPlan({ ...catalog, offices: [weekday, farSaturday] }, base, ctx);
    if (r.status !== "ok") throw new Error(r.status);
    // The no-leave plan may be merged with another identical plan (e.g. "fastest");
    // what matters is that the recommended option covers no_leave, for that reason.
    const rec = r.options.find((o) => o.key === r.recommended)!;
    expect([rec.key, ...rec.alsoBest]).toContain("no_leave");
    expect(r.reasons).toEqual([{ code: "no_leave_available" }]);
    const fastest = r.options.find((o) => o.key === "fastest")!;
    expect(fastest.steps[0].office?.id).toBe("weekday");
    expect(fastest.totals.leaveDays).toBe(2);
    const noLeave = rec;
    expect(noLeave.available).toBe(true);
    expect(noLeave.totals.leaveDays).toBe(0);
    expect(noLeave.steps.map((s) => [s.documentId, s.office?.id, s.when.kind])).toEqual([
      ["bc", "saturday", "free_time"],
      ["passport", "saturday", "free_time"],
    ]);
    expect(noLeave.steps[0].id).toBe("no_leave:bc");
    expect(noLeave.risks).toContainEqual({ code: "appointment_required", officeName: "Office saturday" });
  });

  it("returns 2 to 4 options and merges identical ones", () => {
    const r = buildPlan(catalog, base, ctx);
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.options.length).toBeGreaterThanOrEqual(1);
    expect(r.options.length).toBeLessThanOrEqual(4);
    const covered = r.options.flatMap((o) => [o.key, ...o.alsoBest]).sort();
    expect(covered).toEqual(["cheapest", "fastest", "fewest_visits", "no_leave"]);
  });

  it("marks no-leave unavailable when no office opens in free time, and warns about leave", () => {
    const r = buildPlan({ ...catalog, offices: [weekday] }, base, ctx);
    if (r.status !== "ok") throw new Error(r.status);
    const noLeave = r.options.find((o) => o.key === "no_leave" || o.alsoBest.includes("no_leave"))!;
    expect(noLeave.available).toBe(false);
    const rec = r.options.find((o) => o.key === r.recommended)!;
    expect(rec.totals.leaveDays).toBe(2);
    expect(rec.risks).toContainEqual({ code: "needs_more_leave", needed: 2, available: 0 });
    expect(rec.steps[0].when).toEqual({ kind: "leave", day: "mon", start: "08:00", end: "17:00" });
  });

  it("recommends the fastest option when urgent, and flags slow or over-budget plans", () => {
    const r = buildPlan(catalog, { ...base, goal: { kind: "document", documentId: "natid" }, leaveDays: 2, urgency: "asap", budget: 100 }, ctx);
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.recommended).toBe(r.options.find((o) => o.key === "fastest" || o.alsoBest.includes("fastest"))!.key);
    const rec = r.options.find((o) => o.key === r.recommended)!;
    expect(rec.risks).toContainEqual({ code: "slow_for_urgency", days: 93 });
    expect(rec.risks).toContainEqual({ code: "over_budget", budget: 100, costMin: 155 });
  });

  it("passes through 'already have it' and blocks impossible schedules", () => {
    expect(buildPlan(catalog, { ...base, have: ["passport"] }, ctx)).toEqual({ status: "already_satisfied", satisfiedBy: ["passport"] });
    expect(buildPlan(catalog, { ...base, schedule: { preset: "custom", custom: { days: [], start: "08:00", end: "09:00" } } }, ctx)).toMatchObject({ status: "blocked", reason: "no_free_time" });
  });

  it("reports a missing office as a risk instead of inventing one", () => {
    const r = buildPlan({ ...catalog, offices: [] }, base, ctx);
    if (r.status !== "ok") throw new Error(r.status);
    const o = r.options[0];
    expect(o.steps.every((s) => s.office === null && s.when.kind === "no_office")).toBe(true);
    expect(r.options.every((x) => !x.available)).toBe(true); // not actionable without an office
    expect(o.risks).toContainEqual({ code: "no_office_found", documentName: "BC" });
  });
});


describe("planner wording", () => {
  const t = en.planner;
  it("never says 0 km or 0 minutes", () => {
    expect(officeReasonText(t, { code: "near", km: 0 })).toBe("Near you (<1 km)");
    expect(officeReasonText(t, { code: "near", km: 2.5 })).toBe("Near you (2.5 km)");
    expect(travelText(t, 0)).toBeNull();
    expect(travelText(t, 25)).toBe("About 25 min away");
  });
  it("describes timing and risks in plain words", () => {
    expect(whenText(t, en.offices.days, { kind: "free_time", day: "sat", start: "08:00", end: "12:00" })).toBe(
      "Go on Saturday, between 8:00 AM and 12:00 PM (during your free time).",
    );
    expect(riskText(t, { code: "over_budget", budget: 100, costMin: 155 })).toBe("Fees start at ₱155, above your budget of ₱100.");
    expect(riskText(t, { code: "needs_more_leave", needed: 2, available: 0 })).toBe("This plan needs 2 leave day(s); you said you can take 0.");
  });
});
