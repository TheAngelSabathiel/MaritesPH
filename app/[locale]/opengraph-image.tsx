/** Default Open Graph image for every page that doesn't define its own. */
import { ImageResponse } from "next/og";
import { isLocale, locales } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { OG_SIZE, OgCard } from "@/lib/seo/og-card";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Marites PH";

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionaryFor(isLocale(locale) ? locale : "en");
  return new ImageResponse(<OgCard title={t.brand.greeting} subtitle={t.home.intro} tagline={t.meta.tagline} />, size);
}
