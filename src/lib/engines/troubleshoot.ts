/**
 * Chika sa Pila troubleshooter engine. Dependencies are injected (cache,
 * storage, AI runner), so the flow is unit-tested without network or database.
 *   1. A similar recent question for the same document and language -> cached answer.
 *   2. Otherwise ask the AI with web search limited to community domains.
 *   3. Validate the JSON (Zod) and ground every source: a link is kept only if
 *      the search returned it and it is on an allowed domain. Resolutions left
 *      with no source are dropped.
 *   4. Store the short result (summary + links, never thread text).
 */
import { z } from "zod";
import type { AiRunner } from "@/lib/ai/client";
import { extractJson, groundedUrl } from "@/lib/ai/core";
import { troubleshootPrompt } from "@/lib/ai/prompts/troubleshoot";

const aiSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  causes: z.array(z.string().trim().min(1).max(250)).max(6).default([]),
  resolutions: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(400),
        officialChannel: z.string().trim().max(150).nullable().default(null),
        sources: z.array(z.object({ url: z.string() })).max(6).default([]),
      }),
    )
    .max(6)
    .default([]),
  confidence: z.enum(["low", "medium", "high"]),
  recency: z.string().trim().max(120).default(""),
  officialGuidance: z.string().trim().max(400).default(""),
});

export type TroubleshootResult = {
  summary: string;
  causes: string[];
  resolutions: { text: string; officialChannel: string | null; sources: { url: string; title: string; date: string | null }[] }[];
  confidence: "low" | "medium" | "high";
  recency: string;
  officialGuidance: string;
  generatedAt: string;
};

export const storedResultSchema = z.object({
  summary: z.string(),
  causes: z.array(z.string()),
  resolutions: z.array(
    z.object({
      text: z.string(),
      officialChannel: z.string().nullable(),
      sources: z.array(z.object({ url: z.string(), title: z.string(), date: z.string().nullable() })),
    }),
  ),
  confidence: z.enum(["low", "medium", "high"]),
  recency: z.string(),
  officialGuidance: z.string(),
  generatedAt: z.string(),
});

export type TroubleshootOutcome =
  | { status: "ok"; result: TroubleshootResult; cached: boolean }
  | { status: "no_results" | "unavailable" | "over_budget" | "invalid" };

export type TroubleshootDeps = {
  run: AiRunner;
  domains: string[];
  findCached: (documentId: string, problem: string, locale: "en" | "fil") => Promise<TroubleshootResult | null>;
  store: (row: { documentId: string; problem: string; locale: "en" | "fil"; result: TroubleshootResult }) => Promise<void>;
  now: () => Date;
};

export async function troubleshoot(
  input: { documentId: string; documentName: string; agencyName: string | null; problem: string; locale: "en" | "fil"; userId: string | null },
  deps: TroubleshootDeps,
): Promise<TroubleshootOutcome> {
  const cached = await deps.findCached(input.documentId, input.problem, input.locale);
  if (cached) return { status: "ok", result: cached, cached: true };

  const { system, prompt } = troubleshootPrompt(input);
  const res = await deps.run({ purpose: "troubleshoot", system, prompt, maxTokens: 1500, webSearch: { domains: deps.domains, maxUses: 4 }, userId: input.userId });
  if (res.status === "over_budget") return { status: "over_budget" };
  if (res.status !== "ok") return { status: "unavailable" };

  const parsed = aiSchema.safeParse(extractJson(res.text));
  if (!parsed.success) return { status: "invalid" };

  const resolutions = parsed.data.resolutions
    .map((r) => ({
      text: r.text,
      officialChannel: r.officialChannel,
      sources: r.sources
        .map((s) => groundedUrl(s.url, res.sources, deps.domains))
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => ({ url: s.url, title: s.title, date: s.pageAge })),
    }))
    .filter((r) => r.sources.length > 0);
  if (resolutions.length === 0) return { status: "no_results" };

  const result: TroubleshootResult = {
    summary: parsed.data.summary,
    causes: parsed.data.causes,
    resolutions,
    confidence: parsed.data.confidence,
    recency: parsed.data.recency,
    officialGuidance: parsed.data.officialGuidance,
    generatedAt: deps.now().toISOString(),
  };
  await deps.store({ documentId: input.documentId, problem: input.problem, locale: input.locale, result });
  return { status: "ok", result, cached: false };
}
