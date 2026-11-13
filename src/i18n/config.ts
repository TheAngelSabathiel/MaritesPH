/**
 * Locale configuration. Pure module: safe to import anywhere (client, server,
 * proxy, tests). Routing is sub-path based: /en/... and /fil/...
 */
export const locales = ["en", "fil"] as const;
export type Locale = (typeof locales)[number];

/** Used when the browser sends no usable Accept-Language header. */
export const defaultLocale: Locale = "en";

/** Cookie set by the language switcher so the choice sticks across visits. */
export const LOCALE_COOKIE = "marites_locale";

/** hreflang values for <link rel="alternate">. */
export const hreflang: Record<Locale, string> = {
  en: "en-PH",
  fil: "fil-PH",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/**
 * Pick the best locale from an Accept-Language header.
 * Filipino is sent by browsers as "fil" or "tl" (Tagalog), sometimes with a
 * region (fil-PH, tl-PH). Everything else falls back to English.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.trim().slice(2)) : 1;
      return { base: tag.split("-")[0], quality: Number.isNaN(quality) ? 0 : quality };
    })
    .filter((entry) => entry.base && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { base } of ranked) {
    if (base === "fil" || base === "tl") return "fil";
    if (base === "en") return "en";
  }
  return defaultLocale;
}

/** Replace the locale prefix of a pathname, e.g. /en/login -> /fil/login. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const segments = pathname.split("/");
  if (isLocale(segments[1])) {
    segments[1] = target;
    return segments.join("/") || `/${target}`;
  }
  return `/${target}${pathname === "/" ? "" : pathname}`;
}
