import { describe, expect, it, vi } from "vitest";
import type { AiRequest, AiResult } from "@/lib/ai/client";
import { runPipeline, type FetchResult, type IssuanceRow, type PipelineDeps, type SourceRow } from "@/lib/monitoring/pipeline";

const DOC = "d0000000-0000-0000-0000-000000000001";
const LIST_HTML = `<a href="/issuances/advisory-2026-5">Passport Advisory No. 5 on fees</a><a href="https://elsewhere.example.com/circular">Other circular</a>`;
const ISSUANCE_TEXT = "The passport fee for regular processing is set at one thousand pesos. ".repeat(10);
const doc = { name: "Philippine Passport", slug: "passport", type: "id", agency_id: null, description: null, purpose_tags: [], validity_text: null, validity_months: 120, processing_days_min: null, processing_days_max: null, processing_note: null, fee_min: 950, fee_max: 1200, fee_note: null, source_url: "https://passport.gov.ph", to_verify_note: null };

function makeDeps(over: Partial<PipelineDeps> & { pages?: Record<string, FetchResult>; ai?: (req: AiRequest) => AiResult }) {
  const state = {
    sourceUpdates: [] as Record<string, unknown>[],
    issuances: [] as Record<string, unknown>[],
    issuanceUpdates: [] as [string, Record<string, unknown>][],
    links: [] as Record<string, unknown>[],
    proposals: [] as Record<string, unknown>[],
  };
  const source: SourceRow = { id: "s1", url: "https://dfa.gov.ph/advisories", parser_key: "auto", parser_config: {}, topic: "ids", listing_hash: null, failure_count: 0 };
  const pending: IssuanceRow[] = [{ id: "i1", url: "https://dfa.gov.ph/issuances/advisory-2026-5", title: "Passport Advisory No. 5 on fees", topic: "ids", extraction_status: "pending", extracted_text: null, attempts: 0 }];
  const deps: PipelineDeps = {
    now: () => new Date("2026-11-16T00:00:00Z"),
    deadline: Date.now() + 60_000,
    aiEnabled: true,
    run: vi.fn(async (req: AiRequest) => (over.ai ? over.ai(req) : { status: "disabled" as const })),
    officialDomains: ["gov.ph"],
    dueSources: async () => [source],
    fetch: async (url) => over.pages?.[url] ?? { ok: false, error: "HTTP 404" },
    pdfText: async () => "",
    updateSource: async (_id, patch) => void state.sourceUpdates.push(patch),
    knownUrls: async () => new Set(),
    insertIssuances: async (rows) => void state.issuances.push(...rows),
    pendingIssuances: async () => pending,
    updateIssuance: async (id, patch) => void state.issuanceUpdates.push([id, patch]),
    candidates: async () => [{ targetType: "document", id: DOC, label: "Philippine Passport" }],
    getRecord: async () => doc,
    insertLink: async (row) => void state.links.push(row),
    insertProposal: async (row) => void state.proposals.push(row),
    ...over,
  };
  return { deps, state };
}

const pages = {
  "https://dfa.gov.ph/advisories": { ok: true as const, contentType: "text/html", text: LIST_HTML },
  "https://dfa.gov.ph/issuances/advisory-2026-5": { ok: true as const, contentType: "text/html", text: `<p>${ISSUANCE_TEXT}</p>` },
};
const aiOk = (req: AiRequest): AiResult => ({
  status: "ok",
  sources: [],
  usage: { inputTokens: 1, outputTokens: 1, webSearches: 0 },
  text: req.system.includes("classify")
    ? JSON.stringify({ issuanceType: "advisory", issuingBody: "DFA", issuanceNumber: "Advisory 5", dateIssued: "2026-11-01", effectiveDate: null, topic: "ids", summary: "Sets the regular passport fee.", affected: [{ id: DOC, relevance: 0.9, reason: "fee" }, { id: "invented-id", relevance: 1, reason: "x" }] })
    : JSON.stringify({ fields: { fee_min: 1000 }, rationale: "Section 2 sets the fee at 1,000.", publicSummary: "Regular passport fee updated." }),
});

describe("Bantay Batas pipeline", () => {
  it("crawls, records only official links, extracts, classifies, links, and proposes", async () => {
    const { deps, state } = makeDeps({ pages, ai: aiOk });
    const report = await runPipeline(deps);
    expect(state.issuances).toEqual([{ source_id: "s1", url: "https://dfa.gov.ph/issuances/advisory-2026-5", title: "Passport Advisory No. 5 on fees", date_issued: null, topic: "ids" }]);
    expect(state.sourceUpdates.at(-1)).toMatchObject({ failure_count: 0, last_error: null });
    expect(state.links).toEqual([{ issuance_id: "i1", target_type: "document", target_id: DOC, relevance_score: 0.9, reason: "fee" }]);
    expect(state.proposals).toEqual([
      { issuance_id: "i1", target_type: "document", target_id: DOC, proposed_change: { fields: { fee_min: { before: 950, after: 1000 } } }, ai_rationale: "Section 2 sets the fee at 1,000.", public_summary: "Regular passport fee updated.", source_urls: ["https://dfa.gov.ph/issuances/advisory-2026-5"] },
    ]);
    expect(report).toMatchObject({ sourcesChecked: 1, newIssuances: 1, extracted: 1, classified: 1, proposals: 1 });
  });

  it("counts source failures and skips unchanged listings", async () => {
    const failing = makeDeps({ pages: {} });
    await runPipeline(failing.deps);
    expect(failing.state.sourceUpdates[0]).toMatchObject({ failure_count: 1, last_error: "HTTP 404" });

    const { createHash } = await import("node:crypto");
    const same = makeDeps({ pages, dueSources: async () => [{ id: "s1", url: "https://dfa.gov.ph/advisories", parser_key: "auto", parser_config: {}, topic: "ids", listing_hash: createHash("sha256").update(LIST_HTML).digest("hex"), failure_count: 0 }], pendingIssuances: async () => [] });
    await runPipeline(same.deps);
    expect(same.state.issuances).toEqual([]);
  });

  it("with AI off: extracts but leaves classification pending (no AI calls)", async () => {
    const { deps, state } = makeDeps({ pages, aiEnabled: false });
    await runPipeline(deps);
    expect(deps.run).not.toHaveBeenCalled();
    expect(state.issuanceUpdates.some(([, p]) => p.extraction_status === "ok")).toBe(true);
    expect(state.issuanceUpdates.some(([, p]) => "classification_status" in p)).toBe(false);
  });

  it("drops an invalid proposal but keeps the link as legal context", async () => {
    const bad = (req: AiRequest): AiResult => (req.system.includes("classify") ? aiOk(req) : { ...aiOk(req), text: JSON.stringify({ fields: { slug: "hacked" } }) } as AiResult);
    const { deps, state } = makeDeps({ pages, ai: bad });
    await runPipeline(deps);
    expect(state.links).toHaveLength(1);
    expect(state.proposals).toEqual([]);
  });

  it("marks scanned PDFs for OCR and skips classification", async () => {
    const pdfPages = { ...pages, "https://dfa.gov.ph/issuances/advisory-2026-5": { ok: true as const, contentType: "application/pdf", text: "", bytes: new Uint8Array([1]) } };
    const { deps, state } = makeDeps({ pages: pdfPages, ai: aiOk, pdfText: async () => "  " });
    await runPipeline(deps);
    expect(state.issuanceUpdates.find(([, p]) => p.extraction_status)?.[1]).toMatchObject({ extraction_status: "needs_ocr", classification_status: "skipped" });
    expect(deps.run).not.toHaveBeenCalled();
  });
});
