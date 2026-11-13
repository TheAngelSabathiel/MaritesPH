/** Open Graph image for a guide: the document name on the Marites PH card. */
import { ImageResponse } from "next/og";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { getGuide, listGuideSlugs } from "@/lib/content/public";
import { OG_SIZE, OgCard } from "@/lib/seo/og-card";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Marites PH guide";

export async function generateStaticParams() {
  const slugs = await listGuideSlugs();
  return (slugs.length ? slugs : ["__none__"]).map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const loc = isLocale(locale) ? locale : "en";
  const [t, guide] = await Promise.all([getDictionaryFor(loc), getGuide(slug)]);
  const title = guide?.document.name ?? t.meta.siteName;
  const subtitle = guide?.agency ? format(t.guides.issuedBy, { agency: guide.agency.name }) : t.guides.indexTitle;
  return new ImageResponse(<OgCard title={title} subtitle={subtitle} tagline={t.meta.tagline} />, size);
}
