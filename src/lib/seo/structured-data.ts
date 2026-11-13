/**
 * schema.org JSON-LD builders for guide and office pages. Pure functions.
 * We describe processes and offices; we never claim to BE the agency, so no
 * GovernmentService "provider" claims are made for Marites PH itself.
 */
import { DAYS, type Hours } from "@/lib/content/hours";

export type Crumb = { name: string; url: string };

export function breadcrumbList(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
  };
}

export function howTo(input: {
  name: string;
  description: string | null;
  url: string;
  inLanguage: string;
  steps: { title: string; body: string; estimatedMinutes: number | null }[];
  supplies: string[];
  feeMin: number | null;
  dateModified: string | null;
}) {
  const totalMinutes = input.steps.reduce((sum, s) => sum + (s.estimatedMinutes ?? 0), 0);
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    inLanguage: input.inLanguage,
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(totalMinutes > 0 ? { totalTime: `PT${totalMinutes}M` } : {}),
    ...(input.feeMin != null ? { estimatedCost: { "@type": "MonetaryAmount", currency: "PHP", value: input.feeMin } } : {}),
    ...(input.supplies.length ? { supply: input.supplies.map((name) => ({ "@type": "HowToSupply", name })) } : {}),
    step: input.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.body || s.title,
      url: `${input.url}#step-${i + 1}`,
    })),
  };
}

const SCHEMA_DAYS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function governmentOffice(input: {
  name: string;
  url: string;
  address: string | null;
  city: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  hours: Hours;
}) {
  const hours = DAYS.flatMap((d) =>
    (input.hours[d] ?? []).map(([opens, closes]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${SCHEMA_DAYS[d]}`,
      opens,
      closes,
    })),
  );
  return {
    "@context": "https://schema.org",
    "@type": "GovernmentOffice",
    name: input.name,
    url: input.url,
    address: {
      "@type": "PostalAddress",
      ...(input.address ? { streetAddress: input.address } : {}),
      ...(input.city ? { addressLocality: input.city } : {}),
      ...(input.region ? { addressRegion: input.region } : {}),
      addressCountry: "PH",
    },
    ...(input.lat != null && input.lng != null
      ? { geo: { "@type": "GeoCoordinates", latitude: input.lat, longitude: input.lng } }
      : {}),
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
  };
}

/** Serialize for a <script type="application/ld+json">, safe against "</script>" injection. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
