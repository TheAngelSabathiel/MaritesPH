import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { hasWeekendHours } from "@/lib/content/hours";
import { agencySlug, cityAgencyPath, citySlug, formatAddress, officePath } from "@/lib/content/offices";
import { cachedNow, getOfficeWait, listApprovedTips, listOfficeLegal, listOffices } from "@/lib/content/public";
import { TipsList } from "@/components/community/tips";
import { TipForm } from "@/components/community/tip-form";
import { serverEnv } from "@/lib/env.server";
import { absoluteUrl, pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbList, governmentOffice } from "@/lib/seo/structured-data";
import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { HoursTable } from "@/components/public/hours-table";
import { LegalBasis } from "@/components/public/legal-basis";
import { MapToggle } from "@/components/public/map-toggle";
import { OpenStatusBadge } from "@/components/public/open-status";
import { ReportButton } from "@/components/public/report-button";
import { VerificationBlock } from "@/components/public/verification-block";

type Props = PageProps<"/[locale]/offices/[city]/[agency]/[office]">;

export async function generateStaticParams() {
  const offices = await listOffices();
  if (!offices.length) return [{ city: "__none__", agency: "__none__", office: "__none__" }];
  return offices.map((o) => ({ city: citySlug(o.city), agency: agencySlug(o.agency), office: o.slug }));
}

async function findOffice(slug: string) {
  return (await listOffices()).find((o) => o.slug === slug) ?? null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, office: slug } = await props.params;
  if (!isLocale(locale)) return {};
  const [t, office] = await Promise.all([getDictionaryFor(locale), findOffice(slug)]);
  if (!office) return { title: t.errors.notFoundTitle, robots: { index: false } };
  const path = officePath(locale, office).slice(locale.length + 1);
  return pageMetadata({
    locale,
    path,
    title: `${office.name} (${office.agency.acronym ?? office.agency.name})`,
    description: [office.address, t.offices.finderIntro].filter(Boolean).join(". "),
  });
}

export default async function OfficePage(props: Props) {
  const { locale, city, agency, office: slug } = await props.params;
  if (!isLocale(locale)) notFound();
  const [t, office, now] = await Promise.all([getDictionaryFor(locale), findOffice(slug), cachedNow()]);
  if (!office) notFound();
  // The office's city or agency changed: send old links to the current URL.
  if (citySlug(office.city) !== city || agencySlug(office.agency) !== agency) permanentRedirect(officePath(locale, office));

  const [legal, tips, wait] = await Promise.all([listOfficeLegal(office.id), listApprovedTips(office.id), getOfficeWait(office.id)]);
  const url = absoluteUrl(officePath(locale, office));
  const agencyName = office.agency.acronym ?? office.agency.name;
  const cityTitle = format(t.offices.officesIn, { agency: agencyName, city: office.city ?? "" });
  const directions =
    office.lat != null && office.lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${office.lat},${office.lng}`
      : office.address
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(office.address)}`
        : null;

  return (
    <article className="space-y-6">
      <JsonLd
        data={breadcrumbList([
          { name: t.guides.breadcrumbHome, url: absoluteUrl(`/${locale}`) },
          { name: t.offices.finderTitle, url: absoluteUrl(`/${locale}/offices`) },
          { name: cityTitle, url: absoluteUrl(cityAgencyPath(locale, office)) },
          { name: office.name, url },
        ])}
      />
      <JsonLd
        data={governmentOffice({ name: office.name, url, address: office.address, city: office.city, region: office.region, lat: office.lat, lng: office.lng, hours: office.hours })}
      />

      <div className="space-y-3">
        <Breadcrumbs
          label={t.nav.breadcrumb}
          items={[
            { name: t.guides.breadcrumbHome, href: `/${locale}` },
            { name: t.offices.finderTitle, href: `/${locale}/offices` },
            { name: cityTitle, href: cityAgencyPath(locale, office) },
            { name: office.name },
          ]}
        />
        <p className="font-semibold text-muted-foreground">{office.agency.name}</p>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{office.name}</h1>
        <OpenStatusBadge hours={office.hours} t={t.offices} />
        <VerificationBlock
          lastVerifiedAt={office.lastVerifiedAt}
          sourceUrl={office.sourceUrl}
          staleDays={serverEnv().CONTENT_STALE_DAYS}
          now={new Date(now)}
          locale={locale}
          t={t}
        />
      </div>

      <ul className="flex flex-wrap gap-2 text-sm font-semibold">
        {hasWeekendHours(office.hours) ? <li className="rounded-full bg-accent px-3 py-1 text-accent-foreground">{t.offices.weekendBadge}</li> : null}
        <li className="rounded-full bg-muted px-3 py-1">
          {office.acceptsWalkIn === true ? t.offices.walkInYes : office.acceptsWalkIn === false ? t.offices.walkInNo : t.offices.walkInUnknown}
        </li>
      </ul>

      {office.address ? (
        <section aria-labelledby="address" className="space-y-2">
          <h2 id="address" className="text-xl font-bold">
            {t.offices.addressHeading}
          </h2>
          <p className="break-words">{formatAddress(office.address, office.barangay, office.city)}</p>
        </section>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {directions ? (
          <a href={directions} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
            {t.offices.directions}
          </a>
        ) : null}
        {office.appointmentUrl ? (
          <a href={office.appointmentUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
            {t.offices.appointment}
          </a>
        ) : null}
      </div>

      <MapToggle
        points={office.lat != null && office.lng != null ? [{ id: office.id, name: office.name, lat: office.lat, lng: office.lng, href: officePath(locale, office) }] : []}
        labels={{ show: t.offices.showMap, hide: t.offices.hideMap, loading: t.offices.mapLoading, note: t.offices.mapNote }}
      />

      <section aria-labelledby="hours" className="space-y-2">
        <h2 id="hours" className="text-xl font-bold">
          {t.offices.hoursHeading} <span className="text-sm font-normal text-muted-foreground">({t.offices.hoursTimezone})</span>
        </h2>
        <HoursTable hours={office.hours} closedLabel={t.offices.closed} days={t.offices.days} />
        {office.hoursNote ? <p className="text-sm">{office.hoursNote}</p> : null}
      </section>

      {office.documents.length ? (
        <section aria-labelledby="services" className="space-y-2">
          <h2 id="services" className="text-xl font-bold">
            {t.offices.servicesHeading}
          </h2>
          <ul className="divide-y rounded-lg border bg-card">
            {office.documents.map((d) => (
              <li key={d.id}>
                <Link href={`/${locale}/ids/${d.slug}`} className="flex min-h-11 items-center px-4 py-2 font-semibold text-primary underline-offset-2 hover:underline">
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {legal.length ? (
        <section aria-labelledby="legal" className="space-y-2">
          <h2 id="legal" className="text-xl font-bold">
            {t.guides.legalHeading}
          </h2>
          <LegalBasis items={legal} locale={locale} t={t} />
        </section>
      ) : null}

      <section aria-label={t.tips.heading} className="space-y-3">
        <TipsList tips={tips} median={wait} locale={locale} t={t.tips} />
        <TipForm officeId={office.id} t={t.tips} signInHref={`/${locale}/login`} signInLabel={t.nav.signIn} />
      </section>

      <ReportButton targetType="office" targetId={office.id} t={t.report} signInHref={`/${locale}/login`} signInLabel={t.nav.signIn} />
      <p className="text-sm text-muted-foreground">{t.guides.disclaimer}</p>
    </article>
  );
}
