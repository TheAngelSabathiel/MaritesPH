/**
 * Server binding for Bantay Batas: wires the pipeline to Supabase (secret key),
 * the polite fetcher, and the AI client. Called by the cron route and by the
 * admin "Run now" button. Also refreshes community signals from tips.
 */
import "server-only";
import { runAi } from "@/lib/ai/client";
import { aiSettings } from "@/lib/ai/config";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { resourceForTargetType } from "@/lib/admin/resources";
import { createPoliteFetcher, pdfToText } from "./fetcher";
import { runPipeline, type IssuanceRow, type PipelineReport, type SourceRow } from "./pipeline";
import { aggregateTipSignals, type TipForSignals } from "./signals";

export async function runMonitoring(budgetMs = 50_000): Promise<(PipelineReport & { signals: number }) | { error: string }> {
  const db = createSupabaseServiceClient();
  if (!db) return { error: "Supabase secret key not configured" };
  const settings = aiSettings();

  const report = await runPipeline({
    now: () => new Date(),
    deadline: Date.now() + budgetMs,
    aiEnabled: settings.enabled,
    run: runAi,
    officialDomains: settings.officialDomains,
    fetch: createPoliteFetcher(settings.officialDomains),
    pdfText: pdfToText,
    dueSources: async () => {
      const { data } = await db.from("official_sources").select("id, url, parser_key, parser_config, topic, listing_hash, failure_count, crawl_frequency_hours, last_crawled_at").eq("active", true);
      const now = Date.now();
      return ((data ?? []) as (SourceRow & { crawl_frequency_hours: number; last_crawled_at: string | null })[])
        .filter((s) => !s.last_crawled_at || now - Date.parse(s.last_crawled_at) >= s.crawl_frequency_hours * 3_600_000)
        .sort((a, b) => Date.parse(a.last_crawled_at ?? "1970-01-01") - Date.parse(b.last_crawled_at ?? "1970-01-01"));
    },
    updateSource: async (id, patch) => void (await db.from("official_sources").update(patch).eq("id", id)),
    knownUrls: async (urls) => {
      if (!urls.length) return new Set();
      const { data } = await db.from("issuances").select("url").in("url", urls);
      return new Set(((data ?? []) as { url: string }[]).map((r) => r.url));
    },
    insertIssuances: async (rows) => void (await db.from("issuances").upsert(rows, { onConflict: "url", ignoreDuplicates: true })),
    pendingIssuances: async (limit) => {
      const { data } = await db.from("issuances").select("id, url, title, topic, extraction_status, extracted_text, attempts").eq("classification_status", "pending").order("created_at").limit(limit);
      return (data ?? []) as IssuanceRow[];
    },
    updateIssuance: async (id, patch) => void (await db.from("issuances").update(patch).eq("id", id)),
    candidates: async () => {
      const { data } = await db.from("content_index").select("target_type, id, label").in("target_type", ["document", "document_requirement", "guide_step", "office", "agency"]).neq("status", "archived").limit(2000);
      return ((data ?? []) as { target_type: string; id: string; label: string }[]).map((r) => ({ targetType: r.target_type, id: r.id, label: r.label }));
    },
    getRecord: async (type, id) => {
      const resource = resourceForTargetType(type);
      if (!resource) return null;
      const { data } = await db.from(resource.table).select("*").eq("id", id).maybeSingle();
      return (data as Record<string, unknown> | null) ?? null;
    },
    insertLink: async (row) => void (await db.from("issuance_links").upsert(row, { onConflict: "issuance_id,target_type,target_id", ignoreDuplicates: true })),
    insertProposal: async (row) => void (await db.from("change_proposals").insert(row)),
  });

  // Community signals from approved tips (deterministic).
  const { data: tips } = await db.from("tips").select("office_id, wait_minutes, extra_requirements_asked, created_at").eq("status", "approved").gte("created_at", new Date(Date.now() - 31 * 86_400_000).toISOString());
  const signals = aggregateTipSignals((tips ?? []) as TipForSignals[], new Date());
  for (const s of signals) {
    const { data: existing } = await db.from("community_signals").select("id, status").match({ office_id: s.officeId, signal_type: s.type }).is("document_id", null).maybeSingle();
    if (existing) await db.from("community_signals").update({ summary: s.summary, mention_count: s.count, last_seen: new Date().toISOString() }).eq("id", existing.id);
    else await db.from("community_signals").insert({ office_id: s.officeId, signal_type: s.type, summary: s.summary, mention_count: s.count });
  }
  return { ...report, signals: signals.length };
}
