import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { formatPhDate, getFreshness } from "@/lib/content/freshness";
import { Alert } from "@/components/ui/alert";
import { VerifiedStamp } from "@/components/verified-stamp";

/**
 * "Verified ni Marites" stamp with the last-verified date and official source,
 * plus a "may be outdated" warning when the content is older than the threshold.
 * `now` comes from the (hourly) cached render, so the warning appears within an
 * hour of content crossing the threshold.
 */
export function VerificationBlock({
  lastVerifiedAt,
  sourceUrl,
  staleDays,
  now,
  locale,
  t,
}: {
  lastVerifiedAt: string | null;
  sourceUrl: string | null;
  staleDays: number;
  now: Date;
  locale: Locale;
  t: Messages;
}) {
  const freshness = getFreshness(lastVerifiedAt, now, staleDays);
  if (freshness.state === "unverified" || !lastVerifiedAt) {
    return <Alert tone="caution">{t.verification.notYetVerified}</Alert>;
  }
  return (
    <div className="space-y-3">
      <VerifiedStamp
        label={t.features.verifiedBadge}
        dateText={format(t.verification.lastVerified, { date: formatPhDate(lastVerifiedAt, locale) })}
        sourceHref={sourceUrl ?? undefined}
        sourceLabel={sourceUrl ? t.verification.officialSource : undefined}
        className="bg-card"
      />
      {freshness.state === "stale" ? (
        <Alert tone="caution">{format(t.verification.mayBeOutdated, { days: freshness.ageDays })}</Alert>
      ) : null}
    </div>
  );
}
