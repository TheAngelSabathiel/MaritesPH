/**
 * sitemap.xml: home, guide index, every published guide, office finder,
 * city/agency pages, and office pages, each in English and Filipino with
 * hreflang alternates. Regenerated when content changes (cache tag "content").
 */
import type { MetadataRoute } from "next";
import { hreflang, locales } from "@/i18n/config";
import { agencySlug, citySlug, officePath } from "@/lib/content/offices";
import { listGuides, listOffices } from "@/lib/content/public";
import { absoluteUrl } from "@/lib/seo/metadata";

function entry(path: string, lastModified?: string | null, priority = 0.5): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((l) => [hreflang[l], absoluteUrl(`/${l}${path}`)]));
  return locales.map((l) => ({
    url: absoluteUrl(`/${l}${path}`),
    ...(lastModified ? { lastModified } : {}),
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [guides, offices, business] = await Promise.all([listGuides(), listOffices(), listGuides("business")]);
  const cityAgency = new Set(offices.map((o) => `/offices/${citySlug(o.city)}/${agencySlug(o.agency)}`));
  return [
    ...entry("", null, 1),
    ...entry("/ids", null, 0.9),
    ...entry("/offices", null, 0.8),
    ...entry("/ano-ng-bago", null, 0.7),
    ...entry("/business", null, 0.8),
    ...entry("/freelancer", null, 0.6),
    ...entry("/pricing", null, 0.6),
    ...entry("/negosyo", null, 0.6),
    ...entry("/cpas", null, 0.7),
    ...business.flatMap((g) => entry(`/business/${g.slug}`, g.last_verified_at, 0.8)),
    ...entry("/lakad", null, 0.8),
    ...entry("/chika", null, 0.6),
    ...guides.flatMap((g) => entry(`/ids/${g.slug}`, g.last_verified_at, 0.9)),
    ...[...cityAgency].flatMap((p) => entry(p, null, 0.6)),
    ...offices.flatMap((o) => entry(officePath("x", o).slice(2), o.lastVerifiedAt, 0.6)),
    ...["/legal/privacy", "/legal/terms", "/legal/disclaimer"].flatMap((p) => entry(p, null, 0.2)),
  ];
}
