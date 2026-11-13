import { describe, expect, it } from "vitest";
import { groupSources } from "@/lib/admin/sources";
import { adminPath, newRecordPath, withMessage } from "@/lib/admin/paths";
import { resourceBySlug, resources } from "@/lib/admin/resources";

describe("groupSources", () => {
  it("groups by host, counts unverified and missing", () => {
    const { groups, missing } = groupSources([
      { source_url: "https://www.dfa.gov.ph/a", status: "draft", last_verified_at: null },
      { source_url: "https://dfa.gov.ph/a", status: "published", last_verified_at: "2026-05-01T00:00:00Z" },
      { source_url: "https://dfa.gov.ph/b", status: "published", last_verified_at: "2026-03-01T00:00:00Z" },
      { source_url: "https://psa.gov.ph", status: "draft", last_verified_at: null },
      { source_url: null, status: "draft", last_verified_at: null },
    ]);
    expect(missing).toBe(1);
    expect(groups[0]).toMatchObject({ host: "dfa.gov.ph", records: 3, unverified: 1, oldestVerifiedAt: "2026-03-01T00:00:00Z" });
    expect(groups[1].host).toBe("psa.gov.ph");
  });
});

describe("admin paths", () => {
  it("builds paths and messages", () => {
    expect(adminPath("fil", "documents")).toBe("/fil/admin/documents");
    expect(newRecordPath("en", resources.guide_step, { id: "x" })).toBe("/en/admin/steps/new?parent=x");
    expect(newRecordPath("en", resources.legal_reference, { id: "x", type: "document" })).toBe(
      "/en/admin/legal-references/new?parent=x&parent_type=document",
    );
    expect(withMessage("/en/admin?a=1", "notice", "Saved.")).toBe("/en/admin?a=1&notice=Saved.");
  });

  it("resolves every resource by its slug, with unique slugs", () => {
    const slugs = Object.values(resources).map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const r of Object.values(resources)) expect(resourceBySlug(r.slug)?.key).toBe(r.key);
    // Static admin routes must not collide with resource slugs.
    for (const reserved of ["queue", "stale", "flags", "sources", "new"]) expect(slugs).not.toContain(reserved);
  });
});
