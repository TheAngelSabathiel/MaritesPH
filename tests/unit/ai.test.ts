import { describe, expect, it, vi } from "vitest";
import { parseAiSettings } from "@/lib/ai/config";
import { estimateCost, extractJson, groundedUrl, hostAllowed } from "@/lib/ai/core";
import type { AiRequest, AiResult } from "@/lib/ai/client";
import { validatePlanSummary } from "@/lib/ai/plan-summary";
import { troubleshoot, type TroubleshootDeps } from "@/lib/engines/troubleshoot";
import { getLiveContext, type LiveDeps } from "@/lib/context/live";
import { moderateTip } from "@/lib/community/moderation";

const NOW = new Date("2026-11-15T00:00:00Z");
const search = [
  { url: "https://www.reddit.com/r/Philippines/comments/abc/psa_typo", title: "PSA typo", pageAge: "2 weeks ago" },
  { url: "https://psa.gov.ph/advisory/2026-11", title: "PSA advisory", pageAge: null },
];

describe("AI settings", () => {
  it("stays off unless key, model, budget, and prices are all set", () => {
    expect(parseAiSettings({}).enabled).toBe(false);
    expect(parseAiSettings({ ANTHROPIC_API_KEY: "sk-ant-xxxxxxxx", ANTHROPIC_MODEL: "m" }).enabled).toBe(false);
    const on = parseAiSettings({
      ANTHROPIC_API_KEY: "sk-ant-xxxxxxxx", ANTHROPIC_MODEL: "model-x", AI_MONTHLY_BUDGET_USD: "50",
      AI_INPUT_USD_PER_MTOK: "3", AI_OUTPUT_USD_PER_MTOK: "15", AI_WEB_SEARCH_USD_PER_1K: "10",
    });
    expect(on.enabled).toBe(true);
    expect(on.officialDomains).toEqual(["gov.ph"]);
    expect(on.communityDomains).toEqual(["reddit.com"]);
    expect(parseAiSettings({ COMMUNITY_SEARCH_DOMAINS: "reddit.com, Example.org" }).communityDomains).toEqual(["reddit.com", "example.org"]);
    // Malformed values fail safe (AI off) instead of throwing.
    expect(parseAiSettings({ AI_MONTHLY_BUDGET_USD: "lots" }).enabled).toBe(false);
  });
});

describe("AI core", () => {
  it("estimates cost from tokens and searches", () => {
    expect(estimateCost({ inputTokens: 1_000_000, outputTokens: 100_000, webSearches: 3 }, { inputPerMTok: 3, outputPerMTok: 15, webSearchPer1k: 10 })).toBe(4.53);
  });
  it("extracts JSON from fenced or chatty text", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":{"b":2}} hope it helps')).toEqual({ a: { b: 2 } });
    expect(extractJson("no json here")).toBeNull();
  });
  it("grounds links: must be returned by search AND on an allowed domain", () => {
    expect(hostAllowed("https://dfa.gov.ph/x", ["gov.ph"])).toBe(true);
    expect(hostAllowed("https://gov.ph.evil.com/x", ["gov.ph"])).toBe(false);
    expect(groundedUrl("https://www.reddit.com/r/Philippines/comments/abc/psa_typo/", search, ["reddit.com"])?.title).toBe("PSA typo");
    expect(groundedUrl("https://www.reddit.com/r/invented", search, ["reddit.com"])).toBeNull();
    expect(groundedUrl("https://psa.gov.ph/advisory/2026-11", search, ["reddit.com"])).toBeNull();
  });
});

describe("plan summary validation", () => {
  const ctx = { stepIds: ["no_leave:bc"], planNames: ["PSA Birth Certificate", "PSA East Avenue"], catalogNames: ["PSA Birth Certificate", "Philippine Passport", "PSA East Avenue", "DFA Aseana"] };
  const ok = { headline: "Kaya mo 'to!", summary: "Get your PSA Birth Certificate at PSA East Avenue on a Saturday.", referencedStepIds: ["no_leave:bc"] };
  it("accepts a faithful rephrasing", () => {
    expect(validatePlanSummary(ok, ctx)).toMatchObject({ ok: true });
  });
  it("rejects numbers, money, links, foreign names, and unknown steps", () => {
    expect(validatePlanSummary({ ...ok, summary: "It costs 155 at the counter" }, ctx)).toEqual({ ok: false, reason: "numbers" });
    expect(validatePlanSummary({ ...ok, summary: "Bring pesos for the fee, it's cheap." }, ctx)).toEqual({ ok: false, reason: "money" });
    expect(validatePlanSummary({ ...ok, summary: "Book at passport.gov.ph before you go." }, ctx)).toEqual({ ok: false, reason: "links" });
    expect(validatePlanSummary({ ...ok, summary: "Also get a Philippine Passport while you are there." }, ctx)).toEqual({ ok: false, reason: "foreign_name" });
    expect(validatePlanSummary({ ...ok, referencedStepIds: ["fastest:passport"] }, ctx)).toEqual({ ok: false, reason: "unknown_step" });
    expect(validatePlanSummary({ headline: "x" }, ctx)).toEqual({ ok: false, reason: "shape" });
  });
});

const fakeRun = (result: AiResult) => vi.fn<(req: AiRequest) => Promise<AiResult>>().mockResolvedValue(result);
const okText = (obj: unknown): AiResult => ({ status: "ok", text: JSON.stringify(obj), sources: search, usage: { inputTokens: 1, outputTokens: 1, webSearches: 1 } });

describe("troubleshooter engine", () => {
  const input = { documentId: "d1", documentName: "PSA Birth Certificate", agencyName: "PSA", problem: "My name is misspelled on my birth certificate", locale: "en" as const, userId: null };
  const deps = (over: Partial<TroubleshootDeps>): TroubleshootDeps => ({
    run: fakeRun({ status: "disabled" }), domains: ["reddit.com"], findCached: async () => null, store: vi.fn(async () => {}), now: () => NOW, ...over,
  });
  const answer = {
    summary: "People fixed typos through a petition for correction.",
    causes: ["Clerical error at registration"],
    resolutions: [
      { text: "File a petition for correction at the local civil registrar.", officialChannel: "Local civil registrar", sources: [{ url: "https://www.reddit.com/r/Philippines/comments/abc/psa_typo" }] },
      { text: "Invented fix with a fake link", officialChannel: null, sources: [{ url: "https://www.reddit.com/r/made_up" }] },
    ],
    confidence: "medium", recency: "Reports from 2026", officialGuidance: "Contact the PSA or your local civil registrar.",
  };

  it("uses a cached answer without calling the AI", async () => {
    const run = fakeRun(okText(answer));
    const cached = { summary: "c", causes: [], resolutions: [], confidence: "low" as const, recency: "", officialGuidance: "", generatedAt: NOW.toISOString() };
    const r = await troubleshoot(input, deps({ run, findCached: async () => cached }));
    expect(r).toEqual({ status: "ok", result: cached, cached: true });
    expect(run).not.toHaveBeenCalled();
  });

  it("searches only community domains, drops ungrounded links, and stores the result", async () => {
    const run = fakeRun(okText(answer));
    const store = vi.fn(async () => {});
    const r = await troubleshoot(input, deps({ run, store }));
    expect(run.mock.calls[0][0].webSearch).toEqual({ domains: ["reddit.com"], maxUses: 4 });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.result.resolutions).toHaveLength(1);
    expect(r.result.resolutions[0].sources[0]).toEqual({ url: "https://www.reddit.com/r/Philippines/comments/abc/psa_typo", title: "PSA typo", date: "2 weeks ago" });
    expect(store).toHaveBeenCalledOnce();
  });

  it("degrades gracefully", async () => {
    expect(await troubleshoot(input, deps({ run: fakeRun({ status: "over_budget" }) }))).toEqual({ status: "over_budget" });
    expect(await troubleshoot(input, deps({ run: fakeRun({ status: "disabled" }) }))).toEqual({ status: "unavailable" });
    expect(await troubleshoot(input, deps({ run: fakeRun({ ...okText({}), text: "not json" } as AiResult) }))).toEqual({ status: "invalid" });
    const allFake = { ...answer, resolutions: [answer.resolutions[1]] };
    expect(await troubleshoot(input, deps({ run: fakeRun(okText(allFake)) }))).toEqual({ status: "no_results" });
  });
});

describe("live context engine", () => {
  const target = { documentName: "PSA Birth Certificate", agencyName: "PSA", lastVerified: "2026-10-01", verifiedSummary: "Fee 155", locale: "en" as const };
  const base = (over: Partial<LiveDeps>): LiveDeps => ({
    run: fakeRun({ status: "disabled" }),
    domains: { official: ["gov.ph"], community: ["reddit.com"] },
    ttlHours: { official: 24, community: 12 },
    readCache: async () => null,
    writeCache: vi.fn(async () => {}),
    flagConflict: vi.fn(async () => {}),
    allowAiCall: async () => true,
    now: () => NOW,
    ...over,
  });

  it("keeps official and community apart, grounds links, and flags conflicts", async () => {
    const run = vi.fn(async (req: AiRequest): Promise<AiResult> =>
      req.webSearch?.domains.includes("gov.ph")
        ? okText({ items: [{ title: "New fee", issuingBody: "PSA", issuanceNumber: "MC 1", date: "2026-11-01", url: "https://psa.gov.ph/advisory/2026-11", summary: "Fee changed", conflicts: true, conflictNote: "Fee may now differ" }, { title: "Fake", url: "https://www.reddit.com/r/Philippines/comments/abc/psa_typo", conflicts: true }] })
        : okText({ items: [{ url: "https://www.reddit.com/r/Philippines/comments/abc/psa_typo", date: null, summary: "Long lines" }] }),
    );
    const flagConflict = vi.fn(async () => {});
    const writeCache = vi.fn(async () => {});
    const ctx = await getLiveContext(target, base({ run, flagConflict, writeCache }));
    expect(ctx.official?.items.map((i) => i.url)).toEqual(["https://psa.gov.ph/advisory/2026-11"]); // reddit link dropped from official
    expect(ctx.community?.items.map((i) => i.url)).toEqual(["https://www.reddit.com/r/Philippines/comments/abc/psa_typo"]);
    expect(flagConflict).toHaveBeenCalledExactlyOnceWith("Fee may now differ", "https://psa.gov.ph/advisory/2026-11");
    expect(writeCache).toHaveBeenCalledTimes(2);
  });

  it("serves fresh cache without AI, and stale cache when AI is unavailable", async () => {
    const run = fakeRun({ status: "disabled" });
    const cache = { results: { items: [{ url: "https://www.reddit.com/x", date: null, summary: "s", sourceTitle: "t" }] }, fetchedAt: "2026-11-14T00:00:00Z" };
    const fresh = await getLiveContext(target, base({ run, readCache: async (k) => (k === "community" ? { ...cache, expiresAt: "2026-11-16T00:00:00Z" } : null) }));
    expect(fresh.community).toMatchObject({ stale: false });
    expect(fresh.official).toBeNull();
    const stale = await getLiveContext(target, base({ run, readCache: async (k) => (k === "community" ? { ...cache, expiresAt: "2026-11-14T06:00:00Z" } : null) }));
    expect(stale.community).toMatchObject({ stale: true });
  });

  it("doesn't call the AI when rate-limited", async () => {
    const run = fakeRun({ status: "disabled" });
    await getLiveContext(target, base({ run, allowAiCall: async () => false }));
    expect(run).not.toHaveBeenCalled();
  });
});

describe("anti-fixer moderation", () => {
  it("auto-rejects contact details and paid-slot offers", () => {
    expect(moderateTip("Need a slot? PM me, 0917 123 4567").autoReject).toBe(true);
    expect(moderateTip("Rush slot available ₱500 only").autoReject).toBe(true);
    expect(moderateTip("Message me on facebook.com/fixerpage").autoReject).toBe(true);
    expect(moderateTip("Email ako sa juan@example.com").autoReject).toBe(true);
  });
  it("flags but doesn't reject warnings and normal tips", () => {
    expect(moderateTip("Beware of fixers outside the gate, ignore them.")).toEqual({ flags: ["mentions_fixer"], autoReject: false });
    expect(moderateTip("Line was about 2 hours; bring a pen and a photocopy.")).toEqual({ flags: [], autoReject: false });
  });
});
