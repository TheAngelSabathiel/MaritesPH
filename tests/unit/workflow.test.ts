import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  applyEdit,
  canDelete,
  changedFields,
  checkReverify,
  checkTransition,
  type VerificationState,
} from "@/lib/admin/workflow";

const now = new Date("2026-11-12T00:00:00Z");
const ctx = { now, actorId: "admin-1" };
const base: VerificationState = {
  status: "draft",
  source_url: "https://example.gov.ph",
  last_verified_at: null,
  to_verify_note: null,
};

describe("checkTransition", () => {
  it("verifies a clean draft and stamps who/when", () => {
    expect(checkTransition(base, "verified", ctx)).toEqual({
      ok: true,
      patch: { status: "verified", last_verified_at: now.toISOString(), verified_by: "admin-1" },
    });
  });

  it("refuses to verify without a source or with an open TO VERIFY note", () => {
    const r1 = checkTransition({ ...base, source_url: null }, "verified", ctx);
    const r2 = checkTransition({ ...base, to_verify_note: "TO VERIFY: fee" }, "verified", ctx);
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toMatch(/TO VERIFY/);
  });

  it("does not allow draft straight to published", () => {
    expect(checkTransition(base, "published", ctx).ok).toBe(false);
    expect(allowedTransitions("draft")).not.toContain("published");
  });

  it("publishes a verified record", () => {
    const verified = { ...base, status: "verified" as const, last_verified_at: now.toISOString() };
    expect(checkTransition(verified, "published", ctx)).toEqual({ ok: true, patch: { status: "published" } });
  });

  it("requires CPA review where configured", () => {
    const verified = { ...base, status: "verified" as const, last_verified_at: now.toISOString(), cpa_reviewed: false };
    const r = checkTransition(verified, "published", { ...ctx, requiresCpaReview: true });
    expect(r.ok).toBe(false);
    expect(checkTransition({ ...verified, cpa_reviewed: true }, "published", { ...ctx, requiresCpaReview: true }).ok).toBe(true);
  });

  it("allows unpublish, archive and restore", () => {
    const published = { ...base, status: "published" as const, last_verified_at: now.toISOString() };
    expect(checkTransition(published, "draft", ctx)).toEqual({ ok: true, patch: { status: "draft" } });
    expect(checkTransition(published, "archived", ctx).ok).toBe(true);
    expect(checkTransition({ ...base, status: "archived" }, "draft", ctx).ok).toBe(true);
    expect(checkTransition({ ...base, status: "archived" }, "published", ctx).ok).toBe(false);
  });
});

describe("applyEdit", () => {
  const published: VerificationState = { ...base, status: "published", last_verified_at: "2026-10-01T00:00:00Z" };

  it("leaves drafts alone", () => {
    expect(applyEdit(base, base, ["fee_min"], false, ctx)).toEqual({ ok: true, patch: {} });
  });

  it("keeps status when no facts changed", () => {
    expect(applyEdit(published, published, [], false, ctx)).toEqual({ ok: true, patch: {} });
  });

  it("sends a published record back to draft when a fact changes unverified", () => {
    const r = applyEdit(published, published, ["fee_min"], false, ctx);
    expect(r).toMatchObject({ ok: true, patch: { status: "draft" } });
  });

  it("re-verifies instead when the admin confirms", () => {
    const r = applyEdit(published, published, ["fee_min"], true, ctx);
    expect(r).toMatchObject({ ok: true, patch: { last_verified_at: now.toISOString(), verified_by: "admin-1" } });
    if (r.ok) expect(r.patch.status).toBeUndefined();
  });

  it("drops to draft when a TO VERIFY note is added, even if re-verified", () => {
    const r = applyEdit(published, { ...published, to_verify_note: "TO VERIFY: hours" }, [], true, ctx);
    expect(r).toMatchObject({ ok: true, patch: { status: "draft" } });
  });

  it("cannot re-verify without a source", () => {
    const r = applyEdit(published, { source_url: null, to_verify_note: null }, ["fee_min"], true, ctx);
    expect(r).toMatchObject({ ok: true, patch: { status: "draft" } });
  });
});

describe("checkReverify and canDelete", () => {
  it("re-verifies live records only", () => {
    const published = { ...base, status: "published" as const, last_verified_at: "2026-01-01T00:00:00Z" };
    expect(checkReverify(published, ctx)).toEqual({
      ok: true,
      patch: { last_verified_at: now.toISOString(), verified_by: "admin-1" },
    });
    expect(checkReverify(base, ctx).ok).toBe(false);
  });

  it("only deletes never-verified drafts", () => {
    expect(canDelete(base)).toBe(true);
    expect(canDelete({ ...base, last_verified_at: "2026-01-01T00:00:00Z" })).toBe(false);
    expect(canDelete({ ...base, status: "published" })).toBe(false);
  });
});

describe("changedFields", () => {
  it("treats empty values as equal and numeric strings as numbers", () => {
    expect(changedFields({ a: null, b: "950.00" }, { a: "", b: 950 }, ["a", "b"])).toEqual([]);
  });
  it("ignores object key order but sees real changes", () => {
    const before = { hours: { mon: [["08:00", "17:00"]], sun: [] } };
    expect(changedFields(before, { hours: { sun: [], mon: [["08:00", "17:00"]] } }, ["hours"])).toEqual([]);
    expect(changedFields(before, { hours: { sun: [], mon: [["09:00", "17:00"]] } }, ["hours"])).toEqual(["hours"]);
  });
  it("detects array changes", () => {
    expect(changedFields({ t: ["a"] }, { t: ["a", "b"] }, ["t"])).toEqual(["t"]);
  });
});
