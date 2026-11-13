/**
 * Polite fetcher for Bantay Batas (server-only):
 *  - identifies itself (CRAWLER_USER_AGENT, with CRAWLER_CONTACT_EMAIL);
 *  - honours robots.txt (cached per host for the run; 401/403 on robots = don't crawl);
 *  - at least MIN_HOST_GAP_MS between requests to the same host;
 *  - 20 s timeout, 5 MB cap, no cookies, never logs in, stays on official domains
 *    after redirects.
 */
import "server-only";
import { hostAllowed } from "@/lib/ai/core";
import { isAllowed, parseRobots } from "./robots";
import type { FetchResult } from "./pipeline";

export const MIN_HOST_GAP_MS = 3_000;
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 5 * 1024 * 1024;

export function crawlerUserAgent(): string {
  const ua = process.env.CRAWLER_USER_AGENT || "MaritesPHBot/0.1";
  const contact = process.env.CRAWLER_CONTACT_EMAIL;
  return contact ? `${ua} (+mailto:${contact})` : ua;
}

export function createPoliteFetcher(allowedDomains: string[]) {
  const robots = new Map<string, ((path: string) => boolean) | "blocked">();
  const lastHit = new Map<string, number>();
  const ua = crawlerUserAgent();

  async function raw(url: string): Promise<Response> {
    const host = new URL(url).host;
    const wait = (lastHit.get(host) ?? 0) + MIN_HOST_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastHit.set(host, Date.now());
    return fetch(url, { headers: { "user-agent": ua, accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml,application/pdf;q=0.9,*/*;q=0.5" }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), credentials: "omit", cache: "no-store" });
  }

  async function robotsFor(url: string) {
    const u = new URL(url);
    const cached = robots.get(u.host);
    if (cached) return cached;
    let entry: ((path: string) => boolean) | "blocked";
    try {
      const res = await raw(`${u.protocol}//${u.host}/robots.txt`);
      if (res.status === 401 || res.status === 403) entry = "blocked";
      else if (!res.ok) entry = () => true; // no robots.txt: allowed
      else {
        const rules = parseRobots(await res.text(), ua);
        entry = (path) => isAllowed(rules, path);
      }
    } catch {
      entry = () => true; // unreachable robots.txt: allowed (RFC 9309), the page fetch will tell
    }
    robots.set(u.host, entry);
    return entry;
  }

  return async function politeFetch(url: string): Promise<FetchResult> {
    try {
      if (!hostAllowed(url, allowedDomains)) return { ok: false, error: "not an allowed official domain" };
      const rule = await robotsFor(url);
      const u = new URL(url);
      if (rule === "blocked" || !rule(u.pathname + u.search)) return { ok: false, error: "disallowed by robots.txt" };
      const res = await raw(url);
      if (!hostAllowed(res.url || url, allowedDomains)) return { ok: false, error: "redirected off official domains" };
      if (res.status === 401 || res.status === 403) return { ok: false, error: `HTTP ${res.status}: login or access required; not crawled` };
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const length = Number(res.headers.get("content-length") ?? 0);
      if (length > MAX_BYTES) return { ok: false, error: "too large" };
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) return { ok: false, error: "too large" };
      const contentType = res.headers.get("content-type") ?? "";
      const isPdf = /pdf/i.test(contentType);
      return { ok: true, contentType, text: isPdf ? "" : new TextDecoder().decode(buf), bytes: isPdf ? buf : undefined };
    } catch (err) {
      // Give admins something actionable: the network cause (ENOTFOUND, ECONNRESET, TimeoutError...).
      const cause = err instanceof Error && err.cause && typeof err.cause === "object" && "code" in err.cause ? String((err.cause as { code: unknown }).code) : null;
      const name = err instanceof Error ? err.name : "fetch failed";
      return { ok: false, error: cause ? `${name}: ${cause}` : name === "TimeoutError" ? "TimeoutError: no response within 20 s" : name };
    }
  };
}

export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
