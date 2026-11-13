import { describe, expect, it } from "vitest";
import { parseRecordForm } from "@/lib/admin/form";
import { factualFields, resources } from "@/lib/admin/resources";

const DOC = "d0000000-0000-4000-8000-000000000001";
const DOC2 = "d0000000-0000-4000-8000-000000000002";
const getter = (data: Record<string, string>) => (name: string) => data[name] ?? null;

describe("parseRecordForm", () => {
  it("parses a document with coercions", () => {
    const r = parseRecordForm(
      resources.document,
      getter({
        name: "NBI Clearance",
        slug: "nbi-clearance",
        type: "clearance",
        purpose_tags: "employment, valid_id ,",
        fee_min: "1,130",
        fee_max: "",
        source_url: "https://clearance.nbi.gov.ph",
        to_verify_note: "  ",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.purpose_tags).toEqual(["employment", "valid_id"]);
      expect(r.values.fee_min).toBe(1130);
      expect(r.values.fee_max).toBeNull();
      expect(r.values.to_verify_note).toBeNull();
    }
  });

  it("reports field errors", () => {
    const r = parseRecordForm(
      resources.document,
      getter({ name: "X", slug: "Bad Slug", type: "id", fee_min: "500", fee_max: "100", source_url: "ftp://x" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(["fee_max", "name", "slug", "source_url"]);
    }
  });

  it("requires exactly one target on a requirement", () => {
    const both = parseRecordForm(
      resources.document_requirement,
      getter({ document_id: DOC, group_key: "valid_id", option_key: "a", requires_document_id: DOC2, requirement_text: "Also text" }),
    );
    const neither = parseRecordForm(
      resources.document_requirement,
      getter({ document_id: DOC, group_key: "valid_id", option_key: "a" }),
    );
    const self = parseRecordForm(
      resources.document_requirement,
      getter({ document_id: DOC, group_key: "g", option_key: "a", requires_document_id: DOC }),
    );
    expect(both.ok).toBe(false);
    expect(neither.ok).toBe(false);
    expect(self.ok).toBe(false);
    const good = parseRecordForm(
      resources.document_requirement,
      getter({ document_id: DOC, group_key: "valid_id", option_key: "b", requirement_text: "One photo ID" }),
    );
    expect(good.ok && good.values.quantity).toBe(1);
  });

  it("parses office hours and tri-state walk-in", () => {
    const r = parseRecordForm(
      resources.office,
      getter({
        agency_id: DOC,
        name: "Test office",
        lat: "14.6",
        lng: "121.0",
        accepts_walk_in: "no",
        mon_open: "08:00",
        mon_close: "17:00",
        sat_open: "08:00",
        sat_close: "12:00",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.accepts_walk_in).toBe(false);
      expect((r.values.hours as Record<string, unknown>).sat).toEqual([["08:00", "12:00"]]);
    }
    const outside = parseRecordForm(resources.office, getter({ agency_id: DOC, name: "Far", lat: "40" }));
    expect(!outside.ok && outside.errors.lat).toBeTruthy();
  });

  it("splits the legal reference target and maps its errors to the field", () => {
    const r = parseRecordForm(
      resources.legal_reference,
      getter({
        target: `document:${DOC}`,
        source_rank: "1",
        issuance_type: "republic_act",
        citation_title: "Philippine Identification System Act",
        issuing_body: "Congress",
        date_issued: "2018-08-06",
      }),
    );
    expect(r.ok && r.values).toMatchObject({ target_type: "document", target_id: DOC, source_rank: 1 });
    const bad = parseRecordForm(resources.legal_reference, getter({ target: "", source_rank: "5" }));
    expect(!bad.ok && bad.errors.target).toBeTruthy();
    expect(!bad.ok && bad.errors.source_rank).toBeTruthy();
  });
});

describe("factualFields", () => {
  it("excludes non-factual fields and the TO VERIFY note", () => {
    const f = factualFields(resources.document);
    expect(f).toContain("fee_min");
    expect(f).toContain("source_url");
    expect(f).not.toContain("slug");
    expect(f).not.toContain("to_verify_note");
  });
});

describe("seed-style ids", () => {
  it("accepts version-0 UUIDs used by the seed data", () => {
    const r = parseRecordForm(
      resources.accepted_for,
      getter({ document_id: "d0000000-0000-0000-0000-000000000001", purpose: "bank_account" }),
    );
    expect(r.ok).toBe(true);
  });
});
