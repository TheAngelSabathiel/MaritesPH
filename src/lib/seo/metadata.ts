/** Metadata helpers: absolute URLs, canonical + hreflang alternates for both languages. */
import type { Metadata } from "next";
import { hreflang, locales, type Locale } from "@/i18n/config";
import { publicEnv } from "@/lib/env";

export function absoluteUrl(path: string): string {
  return new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
}

/** `path` is the route WITHOUT the locale prefix, e.g. "/ids/passport" or "" for home. */
export function localizedAlternates(locale: Locale, path: string): Metadata["alternates"] {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [hreflang[l], `/${l}${path}`])),
      "x-default": `/en${path}`,
    },
  };
}

export function pageMetadata(input: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  type?: "website" | "article";
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: localizedAlternates(input.locale, input.path),
    openGraph: {
      title: input.title,
      description: input.description,
      url: `/${input.locale}${input.path}`,
      type: input.type ?? "website",
      locale: hreflang[input.locale].replace("-", "_"),
    },
  };
}
