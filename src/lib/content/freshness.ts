/**
 * Content freshness: decides whether a verified fact should carry a
 * "may be outdated" warning. Pure and deterministic (caller passes `now`).
 *
 *   unverified -> no last_verified_at at all (never show as fact)
 *   stale      -> last verified more than `staleAfterDays` ago
 *   fresh      -> otherwise
 *
 * The threshold comes from CONTENT_STALE_DAYS (default 90). The same rule drives
 * the admin re-verification queue (Phase 2).
 */
export type Freshness =
  | { state: "unverified" }
  | { state: "fresh"; ageDays: number }
  | { state: "stale"; ageDays: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getFreshness(
  lastVerifiedAt: Date | string | null | undefined,
  now: Date,
  staleAfterDays: number,
): Freshness {
  if (!lastVerifiedAt) return { state: "unverified" };
  const verified = typeof lastVerifiedAt === "string" ? new Date(lastVerifiedAt) : lastVerifiedAt;
  if (Number.isNaN(verified.getTime())) return { state: "unverified" };

  // A verification date in the future is a data-entry error: treat it as
  // unverified rather than as permanently fresh.
  if (verified.getTime() > now.getTime() + MS_PER_DAY) return { state: "unverified" };

  const ageDays = Math.max(0, Math.floor((now.getTime() - verified.getTime()) / MS_PER_DAY));
  return ageDays > staleAfterDays ? { state: "stale", ageDays } : { state: "fresh", ageDays };
}

/** Format a date for display in Philippine time, in the user's language. */
export function formatPhDate(value: Date | string, locale: "en" | "fil"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "fil" ? "fil-PH" : "en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
}
