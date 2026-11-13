import { describe, expect, it } from "vitest";
import { format } from "@/i18n/format";

describe("format", () => {
  it("replaces known placeholders", () => {
    expect(format("Last verified {date}", { date: "Nov 11" })).toBe("Last verified Nov 11");
    expect(format("{a}{a}{b}", { a: 1, b: "x" })).toBe("11x");
  });
  it("leaves unknown placeholders visible", () => {
    expect(format("Hi {name}", {})).toBe("Hi {name}");
  });
  it("does not resolve prototype keys", () => {
    expect(format("{toString}", {})).toBe("{toString}");
  });
});
