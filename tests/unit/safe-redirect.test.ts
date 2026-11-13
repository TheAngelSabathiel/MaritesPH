import { describe, expect, it } from "vitest";
import { safeRelativePath } from "@/lib/safe-redirect";
import { signInTargets } from "@/lib/auth/finish-sign-in";

describe("safeRelativePath", () => {
  it("allows same-site paths", () => {
    expect(safeRelativePath("/fil/account", "/x")).toBe("/fil/account");
  });
  it("blocks open redirects", () => {
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil.example", "evil", "/a\nb"]) {
      expect(safeRelativePath(bad, "/fallback")).toBe("/fallback");
    }
    expect(safeRelativePath(null, "/fallback")).toBe("/fallback");
  });
});

describe("signInTargets", () => {
  it("keeps the locale of the next path for errors", () => {
    expect(signInTargets("/fil/account")).toEqual({
      success: "/fil/account",
      failure: "/fil/login?error=callback",
    });
  });
  it("falls back to English account page", () => {
    expect(signInTargets("https://evil.example")).toEqual({
      success: "/en/account",
      failure: "/en/login?error=callback",
    });
  });
});
