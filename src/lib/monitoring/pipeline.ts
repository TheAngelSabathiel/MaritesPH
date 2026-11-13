/**
 * Bantay Batas pipeline: fetch → detect → extract → classify → propose.
 * Pure orchestration over injected dependencies (database, fetcher, AI), so it
 * is unit-tested with fakes. It never edits content: it writes issuances,
 * links, and change proposals for the admin review queue.
 *
 * Limits per run keep it inside serverless time limits: a few sources and a
 * few issuances, stopping early when the deadline is near. Unfinished work
 * simply waits for the next run.
 */
import type { AiRunner } from "@/lib/ai/client";
import { extractJson } from "@/lib/ai/core";
import { classifyPrompt, proposePrompt } from "@/lib/ai/prompts/monitoring";
import { proposableFields, rankCandidates, validateClassification, validateProposal, type Candidate } from "./classify";
import { extractionStatus, htmlToText, sha256 } from "./extract";
import { parseListing } from "./parsers";

export const PIPELINE_LIMITS = {
  sourcesPerRun: 3,
  itemsPerListing: 30,
  issuancesPerRun: 5,
  maxAttempts: 3,
  /** Relevance at which an issuance is linked to a record. */
  linkThreshold: 0.3,
  /** Relevance at which a change proposal is drafted. */
  proposeThreshold: 0.6,
  /** Consecutive failures before the source health dashboard raises an alert. */
  alertAfterFailures: 3,
} as const;

export type SourceRow = { id: string; url: string; parser_key: string; parser_config: { linkPattern?: string }; topic: string; listing_hash: string | null; failure_count: number };
export type IssuanceRow = { id: string; url: string; title: string; topic: string; extraction_status: string; extracted_text: string | null; attempts: number };
export type FetchResult = { ok: true; contentType: string; text: string; bytes?: Uint8Array } | { ok: false; error: string };

export type PipelineDeps = {
  now: () => Date;
  deadline: number;
  aiEnabled: boolean;
  run: AiRunner;
  officialDomains: string[];
  dueSources: () => Promise<SourceRow[]>;
  fetch: (url: string) => Promise<FetchResult>;
  pdfText: (bytes: Uint8Array) => Promise<string>;
  updateSource: (id: string, patch: Record<string, unknown>) => Promise<void>;
  knownUrls: (urls: string[]) => Promise<Set<string>>;
  insertIssuances: (rows: Record<string, unknown>[]) => Promise<void>;
  pendingIssuances: (limit: number) => Promise<IssuanceRow[]>;
  updateIssuance: (id: string, patch: Record<string, unknown>) => Promise<void>;
  candidates: () => Promise<Candidate[]>;
  getRecord: (targetType: string, id: string) => Promise<Record<string, unknown> | null>;
  insertLink: (row: Record<string, unknown>) => Promise<void>;
  insertProposal: (row: Record<string, unknown>) => Promise<void>;
};

export type PipelineReport = { sourcesChecked: number; sourceFailures: number; newIssuances: number; extracted: number; classified: number; proposals: number; stoppedEarly: boolean };

const timeLeft = (d: PipelineDeps) => d.deadline - Date.now() > 8_000;

export async function crawlSources(d: PipelineDeps, report: PipelineReport) {
  for (const s of (await d.dueSources()).slice(0, PIPELINE_LIMITS.sourcesPerRun)) {
    if (!timeLeft(d)) return void (report.stoppedEarly = true);
    report.sourcesChecked++;
    const res = await d.fetch(s.url);
    const now = d.now().toISOString();
    if (!res.ok) {
      report.sourceFailures++;
      await d.updateSource(s.id, { last_crawled_at: now, last_error: res.error.slice(0, 500), failure_count: s.failure_count + 1 });
      continue;
    }
    const hash = sha256(res.text);
    if (hash === s.listing_hash) {
      await d.updateSource(s.id, { last_crawled_at: now, last_success_at: now, failure_count: 0, last_error: null });
      continue;
    }
    const items = parseListing({ body: res.text, contentType: res.contentType, baseUrl: s.url, parserKey: s.parser_key, config: s.parser_config, allowedDomains: d.officialDomains, limit: PIPELINE_LIMITS.itemsPerListing });
    const known = await d.knownUrls(items.map((i) => i.url));
    const fresh = items.filter((i) => !known.has(i.url));
    if (fresh.length) await d.insertIssuances(fresh.map((i) => ({ source_id: s.id, url: i.url, title: i.title, date_issued: i.date, topic: s.topic })));
    report.newIssuances += fresh.length;
    await d.updateSource(s.id, { last_crawled_at: now, last_success_at: now, listing_hash: hash, failure_count: 0, last_error: null });
  }
}

export async function processIssuances(d: PipelineDeps, report: PipelineReport) {
  for (const iss of await d.pendingIssuances(PIPELINE_LIMITS.issuancesPerRun)) {
    if (!timeLeft(d)) return void (report.stoppedEarly = true);
    let text = iss.extracted_text ?? "";

    if (iss.extraction_status === "pending") {
      const res = await d.fetch(iss.url);
      if (!res.ok) {
        const attempts = iss.attempts + 1;
        await d.updateIssuance(iss.id, { attempts, ...(attempts >= PIPELINE_LIMITS.maxAttempts ? { extraction_status: "failed", classification_status: "skipped" } : {}) });
        continue;
      }
      const isPdf = /pdf/i.test(res.contentType) || /\.pdf($|\?)/i.test(iss.url);
      text = isPdf && res.bytes ? (await d.pdfText(res.bytes)).slice(0, 200_000) : htmlToText(res.text);
      const status = extractionStatus(text, isPdf ? "pdf" : "html");
      await d.updateIssuance(iss.id, { extracted_text: text || null, content_hash: sha256(text), extraction_status: status, ...(status === "ok" ? {} : { classification_status: "skipped" }) });
      report.extracted++;
      if (status !== "ok") continue;
    }

    // Without AI, issuances wait (pending) for a run where AI is available.
    if (!d.aiEnabled) continue;

    const candidates = rankCandidates(`${iss.title} ${text.slice(0, 5000)}`, await d.candidates());
    const { system, prompt } = classifyPrompt({ title: iss.title, url: iss.url, text, candidates });
    const res = await d.run({ purpose: "monitoring", system, prompt, maxTokens: 1500 });
    const c = res.status === "ok" ? validateClassification(extractJson(res.text), candidates) : null;
    if (!c) {
      const attempts = iss.attempts + 1;
      await d.updateIssuance(iss.id, { attempts, ...(attempts >= PIPELINE_LIMITS.maxAttempts ? { classification_status: "failed" } : {}) });
      continue;
    }
    await d.updateIssuance(iss.id, {
      issuance_type: c.issuanceType,
      issuing_body: c.issuingBody || null,
      issuance_number: c.issuanceNumber,
      date_issued: c.dateIssued,
      effective_date: c.effectiveDate,
      topic: c.topic,
      summary: c.summary,
      classification_status: "done",
    });
    report.classified++;

    for (const a of c.affected.filter((x) => x.relevance >= PIPELINE_LIMITS.linkThreshold)) {
      const cand = candidates.find((x) => x.id === a.id)!;
      await d.insertLink({ issuance_id: iss.id, target_type: cand.targetType, target_id: cand.id, relevance_score: a.relevance, reason: a.reason });
      const fields = proposableFields(cand.targetType);
      if (a.relevance < PIPELINE_LIMITS.proposeThreshold || fields.length === 0 || !timeLeft(d)) continue;
      const current = await d.getRecord(cand.targetType, cand.id);
      if (!current) continue;
      const p = proposePrompt({ issuanceTitle: iss.title, issuanceSummary: c.summary, text, targetType: cand.targetType, label: cand.label, current, fields });
      const pr = await d.run({ purpose: "monitoring", system: p.system, prompt: p.prompt, maxTokens: 1200 });
      const v = pr.status === "ok" ? validateProposal(extractJson(pr.text), cand.targetType, current) : null;
      if (v?.kind !== "change") continue; // no change needed: the link stays as legal context
      await d.insertProposal({
        issuance_id: iss.id,
        target_type: cand.targetType,
        target_id: cand.id,
        proposed_change: { fields: v.fields },
        ai_rationale: v.rationale,
        public_summary: v.publicSummary || null,
        source_urls: [iss.url],
      });
      report.proposals++;
    }
  }
}

export async function runPipeline(d: PipelineDeps): Promise<PipelineReport> {
  const report: PipelineReport = { sourcesChecked: 0, sourceFailures: 0, newIssuances: 0, extracted: 0, classified: 0, proposals: 0, stoppedEarly: false };
  await crawlSources(d, report);
  await processIssuances(d, report);
  return report;
}
