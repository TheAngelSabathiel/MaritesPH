import type { Metadata } from "next";
import Link from "next/link";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { listGuides, PERSONAL_DOCUMENT_TYPES } from "@/lib/content/public";
import { breadcrumbList } from "@/lib/seo/structured-data";
import { absoluteUrl, pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/json-ld";
import { notFound } from "next/navigation";

export async function generateMetadata(props: PageProps<"/[locale]/ids">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionaryFor(locale);
  return pageMetadata({ locale, path: "/ids", title: t.guides.indexTitle, description: t.guides.indexIntro });
}

/** All published personal-document guides, grouped by type. Static; refreshed when content changes. */
export default async function GuidesIndexPage(props: PageProps<"/[locale]/ids">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const [t, guides] = await Promise.all([getDictionaryFor(locale), listGuides()]);
  const typeLabels = t.guides.typeLabels as Record<string, string>;

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbList([
          { name: t.guides.breadcrumbHome, url: absoluteUrl(`/${locale}`) },
          { name: t.guides.indexTitle, url: absoluteUrl(`/${locale}/ids`) },
        ])}
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.guides.indexTitle}</h1>
        <p className="max-w-prose text-lg">{t.guides.indexIntro}</p>
      </header>

      {guides.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 font-semibold text-muted-foreground">{t.guides.indexEmpty}</p>
      ) : (
        PERSONAL_DOCUMENT_TYPES.map((type) => {
          const list = guides.filter((g) => g.type === type);
          if (list.length === 0) return null;
          return (
            <section key={type} aria-labelledby={`type-${type}`} className="space-y-3">
              <h2 id={`type-${type}`} className="text-xl font-bold">
                {typeLabels[type]}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((g) => (
                  <li key={g.id}>
                    <Link href={`/${locale}/ids/${g.slug}`} className="block h-full rounded-lg border bg-card p-4 active:bg-muted">
                      <span className="block text-lg font-bold leading-snug text-primary">{g.name}</span>
                      {g.agency ? (
                        <span className="text-sm text-muted-foreground">
                          {format(t.guides.issuedBy, { agency: g.agency.acronym ?? g.agency.name })}
                        </span>
                      ) : null}
                      {g.description ? <span className="mt-1 block text-sm">{g.description}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
