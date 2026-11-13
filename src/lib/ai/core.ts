/**
 * Pure AI helpers (no SDK, no network): cost estimate, JSON extraction from
 * model text, and source grounding. Unit-tested.
 */

export type Usage = { inputTokens: number; outputTokens: number; webSearches: number };
export type SearchSource = { url: string; title: string; pageAge: string | null };

export function estimateCost(u: Usage, p: { inputPerMTok: number; outputPerMTok: number; webSearchPer1k: number }): number {
  const cost = (u.inputTokens / 1e6) * p.inputPerMTok + (u.outputTokens / 1e6) * p.outputPerMTok + (u.webSearches / 1000) * p.webSearchPer1k;
  return Math.round(cost * 1e6) / 1e6;
}

/**
 * The model is asked for one JSON object; it may wrap it in a code fence or
 * write a sentence around it. Returns the parsed object, or null.
 */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** Normalizes URLs for comparison: lowercase host, no fragment, no trailing slash. */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** A host is allowed if it is one of the domains or a subdomain of one (gov.ph covers dfa.gov.ph). */
export function hostAllowed(url: string, domains: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Grounding: a cited URL is kept only if the model's own web search actually
 * returned it AND it is on an allowed domain. This removes invented links.
 */
export function groundedUrl(url: string, searchResults: SearchSource[], domains: string[]): SearchSource | null {
  const n = normalizeUrl(url);
  if (!n || !hostAllowed(n, domains)) return null;
  return searchResults.find((r) => normalizeUrl(r.url) === n) ?? null;
}
