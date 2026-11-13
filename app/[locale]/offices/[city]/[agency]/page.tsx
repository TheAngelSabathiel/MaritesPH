import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { agencySlug, citySlug, officePath, type PublicOffice } from "@/lib/content/offices";
import { listOffices } from "@/lib/content/public";
import { absoluteUrl, pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbList } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { MapToggle } from "@/components/public/map-toggle";
import { OfficeCard } from "@/components/public/office-card";

type Props = PageProps<"/[locale]/offices/[city]/[agency]">;

export async function generateStaticParams() {
  const offices = await listOffices();
  const pairs = new Map(offices.map((o) => [`${citySlug(o.city)}/${agencySlug(o.agency)}`, { city: citySlug(o.city), agency: agencySlug(o.agency) }]));
  return pairs.size ? [...pairs.values()] : [{ city: "__none__", agency: "__none__" }];
}

async function officesFor(city: string, agency: string): Promise<PublicOffice[]> {
  return (await listOffices()).filter((o) => citySlug(o.city) === city && agencySlug(o.agency) === agency);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, city, agency } = await props.params;
  if (!isLocale(locale)) return {};
  const [t, offices] = await Promise.all([getDictionaryFor(locale), officesFor(city, agency)]);
  const first = offices[0];
  if (!first) return { title: t.errors.notFoundTitle, robots: { index: false } };
  const title = format(t.offices.officesIn, { agency: first.agency.acronym ?? first.agency.name, city: first.city ?? "" });
  return pageMetadata({ locale, path: `/offices/${city}/${agency}`, title, description: t.offices.finderIntro });
}

/** SEO landing page: all offices of one agency in one city, e.g. /en/offices/quezon-city/psa. */
export default async function CityAgencyPage(props: Props) {
  const { locale, city, agency } = await props.params;
  if (!isLocale(locale)) notFound();
  const [t, offices] = await Promise.all([getDictionaryFor(locale), officesFor(city, agency)]);
  const first = offices[0];
  if (!first) notFound();
  const title = format(t.offices.officesIn, { agency: first.agency.acronym ?? first.agency.name, city: first.city ?? "" });

  return (
    <div className="space-y-6">
      <JsonLd
        data={breadcrumbList([
          { name: t.guides.breadcrumbHome, url: absoluteUrl(`/${locale}`) },
          { name: t.offices.finderTitle, url: absoluteUrl(`/${locale}/offices`) },
          { name: title, url: absoluteUrl(`/${locale}/offices/${city}/${agency}`) },
        ])}
      />
      <Breadcrumbs
        label={t.nav.breadcrumb}
        items={[
          { name: t.guides.breadcrumbHome, href: `/${locale}` },
          { name: t.offices.finderTitle, href: `/${locale}/offices` },
          { name: title },
        ]}
      />
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <MapToggle
        points={offices.filter((o) => o.lat != null && o.lng != null).map((o) => ({ id: o.id, name: o.name, lat: o.lat!, lng: o.lng!, href: officePath(locale, o) }))}
        labels={{ show: t.offices.showMap, hide: t.offices.hideMap, loading: t.offices.mapLoading, note: t.offices.mapNote }}
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {offices.map((o) => (
          <li key={o.id}>
            <OfficeCard office={o} locale={locale} t={t.offices} />
          </li>
        ))}
      </ul>
    </div>
  );
}
