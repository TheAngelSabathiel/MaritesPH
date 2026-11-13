import { describe, expect, it } from "vitest";
import { getSupabasePublicConfig, parsePublicEnv } from "@/lib/env";
import { serverEnvSchema } from "@/lib/env.server";

describe("public env", () => {
  it("applies safe defaults when empty", () => {
    const env = parsePublicEnv({});
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(getSupabasePublicConfig(env)).toBeNull();
  });
  it("treats empty strings as unset", () => {
    const env = parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" });
    expect(getSupabasePublicConfig(env)).toBeNull();
  });
  it("returns Supabase config when both values are set", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    });
    expect(getSupabasePublicConfig(env)).toEqual({ url: "https://abc.supabase.co", key: "sb_publishable_x" });
  });
  it("rejects a malformed URL", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "not a url" })).toThrow();
  });
});

describe("server env", () => {
  it("defaults CONTENT_STALE_DAYS to 90", () => {
    expect(serverEnvSchema.parse({}).CONTENT_STALE_DAYS).toBe(90);
  });
  it("coerces and bounds CONTENT_STALE_DAYS", () => {
    expect(serverEnvSchema.parse({ CONTENT_STALE_DAYS: "30" }).CONTENT_STALE_DAYS).toBe(30);
    expect(() => serverEnvSchema.parse({ CONTENT_STALE_DAYS: "0" })).toThrow();
  });
});
