import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { formatPhDate } from "@/lib/content/freshness";
import type { PublicLegalReference } from "@/lib/content/public";

/**
 * "Bakit ganito?": the laws and issuances behind a guide, ordered by the
 * source hierarchy (laws first). Each shows type, issuing body, number, date, link.
 */
export function LegalBasis({ items, locale, t }: { items: PublicLegalReference[]; locale: Locale; t: Messages }) {
  if (items.length === 0) return <p className="text-muted-foreground">{t.guides.legalEmpty}</p>;
  const ranks = t.guides.sourceRanks as Record<string, string>;
  return (
    <ul className="space-y-3">
      {items.map((ref) => (
        <li key={ref.id} className="rounded-lg border bg-card p-4">
          <p className="text-sm font-semibold text-muted-foreground">
            {[ranks[String(ref.source_rank)], ref.issuing_body].filter(Boolean).join(", ")}
          </p>
          <p className="font-bold leading-snug">
            {ref.issuance_number ? `${ref.issuance_number}: ` : ""}
            {ref.citation_title}
          </p>
          <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            {ref.date_issued ? <span>{format(t.guides.issued, { date: formatPhDate(ref.date_issued, locale) })}</span> : null}
            {ref.section ? <span>{format(t.guides.section, { section: ref.section })}</span> : null}
          </p>
          {ref.note ? <p className="mt-1 break-words">{ref.note}</p> : null}
          {ref.appliesTo ? <p className="mt-1 text-sm">{format(t.guides.appliesTo, { item: ref.appliesTo })}</p> : null}
          {ref.source_url ? (
            <a href={ref.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center break-all text-sm font-semibold text-primary underline">
              {t.verification.officialSource}
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
