import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { listOffices } from "@/lib/content/public";
import { absoluteUrl, pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbList } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";
import { OfficeFinder } from "@/components/public/office-finder";

export async function generateMetadata(props: PageProps<"/[locale]/offices">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionaryFor(locale);
  return pageMetadata({ locale, path: "/offices", title: t.offices.finderTitle, description: t.offices.finderIntro });
}

/** Office finder: the published office list is static; filtering happens in the browser. */
export default async function OfficesPage(props: PageProps<"/[locale]/offices">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const [t, offices] = await Promise.all([getDictionaryFor(locale), listOffices()]);

  return (
    <div className="space-y-6">
      <JsonLd
        data={breadcrumbList([
          { name: t.guides.breadcrumbHome, url: absoluteUrl(`/${locale}`) },
          { name: t.offices.finderTitle, url: absoluteUrl(`/${locale}/offices`) },
        ])}
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.offices.finderTitle}</h1>
        <p className="max-w-prose text-lg">{t.offices.finderIntro}</p>
      </header>
      {offices.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 font-semibold text-muted-foreground">{t.offices.finderEmpty}</p>
      ) : (
        <OfficeFinder offices={offices} locale={locale} t={t.offices} />
      )}
    </div>
  );
}
