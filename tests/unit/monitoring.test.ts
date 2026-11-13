import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots } from "@/lib/monitoring/robots";
import { parseFeed, parseHtmlLinks, parseListing } from "@/lib/monitoring/parsers";
import { extractionStatus, htmlToText } from "@/lib/monitoring/extract";
import { proposableFields, rankCandidates, validateClassification, validateProposal } from "@/lib/monitoring/classify";
import { aggregateTipSignals } from "@/lib/monitoring/signals";

describe("robots.txt", () => {
  const txt = `User-agent: *\nDisallow: /private\nAllow: /private/public\nDisallow: /*.pdf$\n\nUser-agent: MaritesPHBot\nDisallow: /no-marites\n`;
  it("uses our group when named, else *", () => {
    const ours = parseRobots(txt, "MaritesPHBot/0.1 (+https://example.com)");
    expect(isAllowed(ours, "/no-marites/x")).toBe(false);
    expect(isAllowed(ours, "/private")).toBe(true); // our group has no such rule
    const star = parseRobots(txt, "OtherBot");
    expect(isAllowed(star, "/private/page")).toBe(false);
    expect(isAllowed(star, "/private/public/page")).toBe(true); // longer Allow wins
    expect(isAllowed(star, "/files/rmc.pdf")).toBe(false);
    expect(isAllowed(star, "/files/rmc.pdf?x=1")).toBe(true); // $ anchors the end
    expect(isAllowed(parseRobots("", "x"), "/anything")).toBe(true);
  });
});

describe("listing parsers", () => {
  it("parses RSS and Atom", () => {
    const rss = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Advisory &amp; Notice]]></title><link>https://www.example.gov.ph/advisory-1</link><pubDate>Mon, 09 Nov 2026 08:00:00 +0800</pubDate></item></channel></rss>`;
    expect(parseFeed(rss, "https://www.example.gov.ph/feed")).toEqual([{ url: "https://www.example.gov.ph/advisory-1", title: "Advisory & Notice", date: "2026-11-09" }]);
    const atom = `<feed><entry><title>Order 5</title><link rel="alternate" href="/orders/5"/><updated>2026-10-01T00:00:00Z</updated></entry></feed>`;
    expect(parseFeed(atom, "https://agency.gov.ph/feed")).toEqual([{ url: "https://agency.gov.ph/orders/5", title: "Order 5", date: "2026-10-01" }]);
  });
  it("finds issuance links on HTML pages and keeps official domains only", () => {
    const html = `<ul><li><a href="/issuances/rmc-99-2026.pdf">RMC No. 99-2026</a></li><li><a href="/about">About us</a></li><li><a href="https://evil.example.com/circular">Fake circular</a></li><li><a href="javascript:void(0)">Memorandum</a></li></ul>`;
    expect(parseHtmlLinks(html, "https://www.bir.gov.ph/list").map((i) => i.url)).toEqual(["https://www.bir.gov.ph/issuances/rmc-99-2026.pdf", "https://evil.example.com/circular"]);
    const items = parseListing({ body: html, contentType: "text/html", baseUrl: "https://www.bir.gov.ph/list", parserKey: "auto", config: {}, allowedDomains: ["gov.ph"], limit: 30 });
    expect(items.map((i) => i.url)).toEqual(["https://www.bir.gov.ph/issuances/rmc-99-2026.pdf"]);
  });
});

describe("extraction", () => {
  it("turns HTML into text without scripts or navigation", () => {
    const t = htmlToText("<html><nav>Menu</nav><script>x()</script><h1>Circular</h1><p>Fee is &amp; was 950.</p></html>");
    expect(t).toBe("Circular\nFee is & was 950.");
  });
  it("flags short PDFs for OCR", () => {
    expect(extractionStatus("x".repeat(50), "pdf")).toBe("needs_ocr");
    expect(extractionStatus("x".repeat(50), "html")).toBe("failed");
    expect(extractionStatus("x".repeat(500), "pdf")).toBe("ok");
  });
});

describe("classification and proposals", () => {
  const candidates = [
    { targetType: "document", id: "d0000000-0000-0000-0000-000000000001", label: "Philippine Passport" },
    { targetType: "office", id: "b0000000-0000-0000-0000-000000000001", label: "DFA Office of Consular Affairs (ASEANA)" },
  ];
  it("keeps only candidate ids", () => {
    const c = validateClassification(
      { issuanceType: "advisory", topic: "ids", summary: "New passport fee", affected: [{ id: "d0000000-0000-0000-0000-000000000001", relevance: 0.9, reason: "fee" }, { id: "made-up", relevance: 1, reason: "x" }] },
      candidates,
    );
    expect(c?.affected.map((a) => a.id)).toEqual(["d0000000-0000-0000-0000-000000000001"]);
    expect(validateClassification({ issuanceType: "rumor", topic: "ids", summary: "x" }, candidates)).toBeNull();
  });
  it("pre-ranks candidates by shared words", () => {
    expect(rankCandidates("DFA advisory on passport fees", candidates).map((c) => c.id)).toEqual([
      "d0000000-0000-0000-0000-000000000001",
      "b0000000-0000-0000-0000-000000000001",
    ]);
  });
  const doc = { name: "Philippine Passport", slug: "passport", type: "id", agency_id: null, description: null, purpose_tags: [], validity_text: null, validity_months: 120, processing_days_min: null, processing_days_max: null, processing_note: null, fee_min: 950, fee_max: 1200, fee_note: null, source_url: "https://passport.gov.ph", to_verify_note: null };
  it("accepts a valid diff on factual fields only", () => {
    expect(proposableFields("document")).toContain("fee_min");
    expect(proposableFields("document")).not.toContain("slug");
    expect(proposableFields("document")).not.toContain("source_url");
    expect(proposableFields("legal_reference")).toEqual([]);
    expect(validateProposal({ fields: { fee_min: 1000 }, rationale: "Circular sets 1000", publicSummary: "Passport fee updated" }, "document", doc)).toEqual({
      kind: "change", fields: { fee_min: { before: 950, after: 1000 } }, rationale: "Circular sets 1000", publicSummary: "Passport fee updated",
    });
  });
  it("rejects non-factual fields, invalid records, and no-op diffs", () => {
    expect(validateProposal({ fields: { slug: "new" } }, "document", doc)).toBeNull();
    expect(validateProposal({ fields: { source_url: "https://x.gov.ph" } }, "document", doc)).toBeNull();
    expect(validateProposal({ fields: { fee_min: 5000 } }, "document", doc)).toBeNull(); // min above max fails the form schema
    expect(validateProposal({ fields: { fee_min: 950 } }, "document", doc)).toEqual({ kind: "no_change", rationale: "" });
    expect(validateProposal({ noChange: true, rationale: "Not relevant" }, "document", doc)).toEqual({ kind: "no_change", rationale: "Not relevant" });
  });
});

describe("community signals", () => {
  const now = new Date("2026-11-16T00:00:00Z");
  const tip = (o: string, wait: number | null, extra: string | null, daysAgo = 1) => ({ office_id: o, wait_minutes: wait, extra_requirements_asked: extra, created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString() });
  it("finds recurring long queues and repeated extra requirements in the last 30 days", () => {
    const signals = aggregateTipSignals([tip("a", 150, null), tip("a", 180, null), tip("a", 200, "Barangay clearance"), tip("a", 300, "barangay clearance", 40), tip("b", 30, "Photo"), tip("b", 20, null)], now);
    expect(signals).toEqual([{ officeId: "a", type: "long_queue", count: 3, summary: "3 recent reports of waits of 120+ minutes." }]);
    const more = aggregateTipSignals([tip("c", 10, "Barangay clearance"), tip("c", 10, "barangay clearance")], now);
    expect(more[0]).toMatchObject({ type: "new_requirement", count: 2, summary: "People report being asked for: barangay clearance" });
  });
});
