/**
 * Renders a legal document (privacy, terms, disclaimer) in the current language,
 * with its version, last-updated date, and the "draft for legal review" notice.
 */
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import type { LegalDoc } from "@/content/legal/types";
import { formatPhDate } from "@/lib/content/freshness";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";
import { Alert } from "@/components/ui/alert";

export function LegalPage({
  title,
  doc,
  version,
  locale,
  t,
}: {
  title: string;
  doc: LegalDoc;
  version?: string;
  locale: Locale;
  t: Messages;
}) {
  return (
    <article className="prose-marites mx-auto">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {format(t.legal.lastUpdated, { date: formatPhDate(LEGAL_LAST_UPDATED, locale) })}
        {version ? <> ({format(t.legal.versionLabel, { version })})</> : null}
      </p>
      <Alert tone="caution" className="mb-6">
        {t.legal.draftNotice}
      </Alert>
      {doc[locale].map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((p) => <p key={p}>{p}</p>)}
          {section.items ? (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </article>
  );
}
