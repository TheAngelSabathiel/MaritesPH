import { describe, expect, it } from "vitest";
import { formatPhDate, getFreshness } from "@/lib/content/freshness";

const now = new Date("2026-11-11T04:00:00Z");

describe("getFreshness", () => {
  it("is unverified with no date or a bad date", () => {
    expect(getFreshness(null, now, 90)).toEqual({ state: "unverified" });
    expect(getFreshness("not a date", now, 90)).toEqual({ state: "unverified" });
  });
  it("is fresh up to and including the threshold", () => {
    expect(getFreshness("2026-11-01T04:00:00Z", now, 90)).toEqual({ state: "fresh", ageDays: 10 });
    expect(getFreshness("2026-08-13T04:00:00Z", now, 90)).toEqual({ state: "fresh", ageDays: 90 });
  });
  it("is stale after the threshold", () => {
    expect(getFreshness("2026-08-12T04:00:00Z", now, 90)).toEqual({ state: "stale", ageDays: 91 });
  });
  it("honours a custom threshold", () => {
    expect(getFreshness("2026-11-01T04:00:00Z", now, 7).state).toBe("stale");
  });
  it("treats a future verification date as unverified (data-entry error)", () => {
    expect(getFreshness("2027-01-01T00:00:00Z", now, 90)).toEqual({ state: "unverified" });
  });
});

describe("formatPhDate", () => {
  it("formats in Asia/Manila time", () => {
    // 2026-11-10T20:00Z is already Nov 11 in Manila (UTC+8).
    expect(formatPhDate("2026-11-10T20:00:00Z", "en")).toContain("11");
    expect(formatPhDate("2026-11-10T20:00:00Z", "en")).toContain("2026");
  });
});
