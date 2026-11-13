/**
 * AI configuration (server-only). AI features are OFF unless every value
 * needed for safe, budgeted use is set: key, model, monthly budget, and the
 * per-token and per-search prices used to estimate cost. Prices are not
 * hardcoded because they differ by model and change over time: set them from
 * Anthropic's pricing page for the model in ANTHROPIC_MODEL.
 */
import "server-only";
import { z } from "zod";

const list = (fallback: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v : fallback),
    z.string().transform((s) => s.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean)),
  );
const optionalNumber = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().positive().optional());

const schema = z.object({
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  ANTHROPIC_MODEL: z.string().min(3).optional(),
  AI_MONTHLY_BUDGET_USD: optionalNumber,
  AI_INPUT_USD_PER_MTOK: optionalNumber,
  AI_OUTPUT_USD_PER_MTOK: optionalNumber,
  AI_WEB_SEARCH_USD_PER_1K: optionalNumber,
  OFFICIAL_SEARCH_DOMAINS: list("gov.ph"),
  COMMUNITY_SEARCH_DOMAINS: list("reddit.com"),
  LIVE_CONTEXT_OFFICIAL_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),
  LIVE_CONTEXT_COMMUNITY_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
});

export type AiSettings = {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  monthlyBudgetUsd: number;
  prices: { inputPerMTok: number; outputPerMTok: number; webSearchPer1k: number };
  officialDomains: string[];
  communityDomains: string[];
  officialTtlHours: number;
  communityTtlHours: number;
};

export function parseAiSettings(env: Record<string, string | undefined>): AiSettings {
  // Fail safe: a malformed value turns AI off (and is logged) instead of crashing pages.
  const result = schema.safeParse(env);
  if (!result.success) {
    console.error("AI settings invalid; AI features are off:", result.error.issues.map((i) => i.path.join(".")).join(", "));
    return { ...parseAiSettings({}), enabled: false };
  }
  const e = result.data;
  const enabled = Boolean(
    e.ANTHROPIC_API_KEY && e.ANTHROPIC_MODEL && e.AI_MONTHLY_BUDGET_USD && e.AI_INPUT_USD_PER_MTOK && e.AI_OUTPUT_USD_PER_MTOK && e.AI_WEB_SEARCH_USD_PER_1K,
  );
  return {
    enabled,
    apiKey: e.ANTHROPIC_API_KEY,
    model: e.ANTHROPIC_MODEL,
    monthlyBudgetUsd: e.AI_MONTHLY_BUDGET_USD ?? 0,
    prices: {
      inputPerMTok: e.AI_INPUT_USD_PER_MTOK ?? 0,
      outputPerMTok: e.AI_OUTPUT_USD_PER_MTOK ?? 0,
      webSearchPer1k: e.AI_WEB_SEARCH_USD_PER_1K ?? 0,
    },
    officialDomains: e.OFFICIAL_SEARCH_DOMAINS,
    communityDomains: e.COMMUNITY_SEARCH_DOMAINS,
    officialTtlHours: e.LIVE_CONTEXT_OFFICIAL_TTL_HOURS,
    communityTtlHours: e.LIVE_CONTEXT_COMMUNITY_TTL_HOURS,
  };
}

let cached: AiSettings | undefined;
export function aiSettings(): AiSettings {
  cached ??= parseAiSettings(process.env as Record<string, string | undefined>);
  return cached;
}
