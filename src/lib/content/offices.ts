/**
 * Office helpers for the public finder and office pages. Pure functions:
 * URL building, filtering, distance, and "open now" in Philippine time.
 * The Philippines has no daylight saving time, so Manila is always UTC+8.
 */
import { slugify } from "@/lib/slug";
import { DAYS, hasWeekendHours, type Day, type Hours } from "./hours-core";

export type PublicOffice = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  region: string | null;
  province: string | null;
  city: string | null;
  barangay: string | null;
  lat: number | null;
  lng: number | null;
  hours: Hours;
  hoursNote: string | null;
  acceptsWalkIn: boolean | null;
  appointmentUrl: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  agency: { id: string; name: string; acronym: string | null };
  /** Published documents handled here. */
  documents: { id: string; slug: string; name: string }[];
};

export function citySlug(city: string | null): string {
  return slugify(city) || "unknown";
}

export function agencySlug(agency: { name: string; acronym: string | null }): string {
  return slugify(agency.acronym || agency.name) || "agency";
}

type PathOffice = { slug: string; city: string | null; agency: { name: string; acronym: string | null } };

export function officePath(locale: string, office: PathOffice): string {
  return `/${locale}/offices/${citySlug(office.city)}/${agencySlug(office.agency)}/${office.slug}`;
}

export function cityAgencyPath(locale: string, office: Omit<PathOffice, "slug">): string {
  return `/${locale}/offices/${citySlug(office.city)}/${agencySlug(office.agency)}`;
}

export type OfficeFilters = {
  query?: string;
  agency?: string; // agency slug
  city?: string; // city slug
  document?: string; // document slug
  weekend?: boolean;
  walkIn?: boolean;
};

export function filterOffices(offices: PublicOffice[], f: OfficeFilters): PublicOffice[] {
  const q = f.query?.trim().toLowerCase();
  return offices.filter((o) => {
    if (f.agency && agencySlug(o.agency) !== f.agency) return false;
    if (f.city && citySlug(o.city) !== f.city) return false;
    if (f.document && !o.documents.some((d) => d.slug === f.document)) return false;
    if (f.weekend && !hasWeekendHours(o.hours)) return false;
    if (f.walkIn && o.acceptsWalkIn !== true) return false;
    if (q) {
      const haystack = [o.name, o.address, o.city, o.barangay, o.province, o.agency.name, o.agency.acronym]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!q.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Nearest first; offices without coordinates go last, in their original order. */
export function sortByDistance<T extends Pick<PublicOffice, "lat" | "lng">>(
  offices: T[],
  from: { lat: number; lng: number },
): (T & { distanceKm: number | null })[] {
  return offices
    .map((o) => ({ ...o, distanceKm: o.lat != null && o.lng != null ? distanceKm(from, { lat: o.lat, lng: o.lng }) : null }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

const MANILA_OFFSET_MINUTES = 8 * 60;

/** Day of week and minutes since midnight in Manila. */
export function manilaClock(date: Date): { day: Day; minutes: number } {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MINUTES * 60_000);
  // getUTCDay: 0 = Sunday. DAYS starts on Monday.
  const day = DAYS[(shifted.getUTCDay() + 6) % 7];
  return { day, minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: { day: Day; time: string; today: boolean } | null };

/** Whether the office is open at `date`, and when it next closes or opens. */
export function openStatus(hours: Hours, date: Date): OpenStatus {
  const { day, minutes } = manilaClock(date);
  const today = hours[day] ?? [];
  for (const [open, close] of today) {
    if (minutes >= toMinutes(open) && minutes < toMinutes(close)) return { open: true, closesAt: close };
  }
  const laterToday = today.find(([open]) => toMinutes(open) > minutes);
  if (laterToday) return { open: false, opensAt: { day, time: laterToday[0], today: true } };

  const start = DAYS.indexOf(day);
  for (let i = 1; i <= 7; i++) {
    const next = DAYS[(start + i) % 7];
    const first = hours[next]?.[0];
    if (first) return { open: false, opensAt: { day: next, time: first[0], today: false } };
  }
  return { open: false, opensAt: null };
}

/** 13:30 -> "1:30 PM" (en) or "1:30 PM" (fil uses the same 12-hour convention). */
export function formatTime(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  const m = hhmm.slice(3, 5);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

/**
 * Full address line without repeating parts the address already contains:
 * "123 Sample St, Sample City" + barangay "Sample Barangay" + city "Sample City"
 * -> "123 Sample St, Sample City, Sample Barangay" (city not repeated).
 */
export function formatAddress(address: string | null, barangay: string | null, city: string | null): string {
  const parts = [address?.trim()].filter((p): p is string => Boolean(p));
  const has = (piece: string) => parts.join(", ").toLowerCase().includes(piece.toLowerCase());
  for (const piece of [barangay, city]) {
    const p = piece?.trim();
    if (p && !has(p)) parts.push(p);
  }
  return parts.join(", ");
}
