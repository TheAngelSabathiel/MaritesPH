/**
 * Listing parsers: turn an official page or feed into candidate issuances.
 * Regex-based on purpose (no DOM library): listings are simple, and output is
 * only a list of links that an admin reviews later. Links must stay on the
 * allowed official domains.
 */
import { hostAllowed } from "@/lib/ai/core";

export type ListingItem = { url: string; title: string; date: string | null };

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
const strip = (s: string) => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function isoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function absolute(href: string, base: string): string | null {
  try {
    const u = new URL(decode(href).trim(), base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

const tag = (block: string, name: string) => new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block)?.[1] ?? null;

/** RSS 2.0 <item> and Atom <entry>. */
export function parseFeed(xml: string, baseUrl: string): ListingItem[] {
  const items: ListingItem[] = [];
  for (const m of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const block = m[0];
    const atomHref = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block)?.[1];
    const link = tag(block, "link");
    const url = absolute(atomHref ?? (link ? strip(link) : ""), baseUrl);
    const title = strip(tag(block, "title") ?? "");
    if (url && title) items.push({ url, title, date: isoDate(tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date")) });
  }
  return items;
}

const DEFAULT_LINK_PATTERN = /(issuance|circular|memorandum|advisory|order|regulation|announcement|release|\.pdf$)/i;

/** Anchors on an HTML listing page whose URL or text matches the pattern. */
export function parseHtmlLinks(html: string, baseUrl: string, pattern?: string): ListingItem[] {
  const re = pattern ? new RegExp(pattern, "i") : DEFAULT_LINK_PATTERN;
  const seen = new Set<string>();
  const items: ListingItem[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = absolute(m[1], baseUrl);
    const title = strip(m[2]);
    if (!url || title.length < 4 || seen.has(url)) continue;
    if (!re.test(url) && !re.test(title)) continue;
    seen.add(url);
    items.push({ url, title: title.slice(0, 500), date: null });
  }
  return items;
}

export function parseListing(input: { body: string; contentType: string; baseUrl: string; parserKey: string; config: { linkPattern?: string }; allowedDomains: string[]; limit: number }): ListingItem[] {
  const looksLikeFeed = /xml|rss|atom/i.test(input.contentType) || /^\s*(<\?xml|<rss|<feed)/i.test(input.body);
  const items =
    input.parserKey === "rss" || (input.parserKey === "auto" && looksLikeFeed)
      ? parseFeed(input.body, input.baseUrl)
      : parseHtmlLinks(input.body, input.baseUrl, input.parserKey === "pdf_links" ? input.config.linkPattern ?? "\\.pdf($|\\?)" : input.config.linkPattern);
  return items.filter((i) => hostAllowed(i.url, input.allowedDomains)).slice(0, input.limit);
}
