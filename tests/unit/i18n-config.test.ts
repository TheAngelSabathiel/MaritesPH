import { describe, expect, it } from "vitest";
import { isLocale, negotiateLocale, switchLocalePath } from "@/i18n/config";

describe("negotiateLocale", () => {
  it("defaults to English with no header", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("")).toBe("en");
  });
  it("maps Filipino and Tagalog tags to fil", () => {
    expect(negotiateLocale("fil-PH,fil;q=0.9,en;q=0.8")).toBe("fil");
    expect(negotiateLocale("tl")).toBe("fil");
  });
  it("respects quality ordering", () => {
    expect(negotiateLocale("en;q=0.5,tl;q=0.9")).toBe("fil");
    expect(negotiateLocale("tl;q=0.4,en-US")).toBe("en");
  });
  it("skips unsupported languages and q=0", () => {
    expect(negotiateLocale("ja,tl;q=0.8")).toBe("fil");
    expect(negotiateLocale("tl;q=0,en;q=0.1")).toBe("en");
    expect(negotiateLocale("ja,ko")).toBe("en");
  });
});

describe("switchLocalePath", () => {
  it("swaps an existing prefix", () => {
    expect(switchLocalePath("/en/legal/privacy", "fil")).toBe("/fil/legal/privacy");
    expect(switchLocalePath("/fil", "en")).toBe("/en");
  });
  it("adds a prefix when missing", () => {
    expect(switchLocalePath("/", "fil")).toBe("/fil");
    expect(switchLocalePath("/about", "en")).toBe("/en/about");
  });
});

describe("isLocale", () => {
  it("accepts only supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fil")).toBe(true);
    expect(isLocale("tl")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
