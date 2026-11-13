import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { cachedNow, getPlannerCatalog, listGuideSlugs } from "@/lib/content/public";
import { buildPlan } from "@/lib/engines/planner";
import { serverEnv } from "@/lib/env.server";
import { isSituation, situationInput, SITUATIONS } from "@/lib/planner/situations";
import { absoluteUrl, pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbList } from "@/lib/seo/structured-data";
import { buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { DiskarteView } from "@/components/planner/diskarte-view";

type Props = PageProps<"/[locale]/ids/[slug]/[situation]">;

export async function generateStaticParams() {
  const slugs = await listGuideSlugs();
  const list = slugs.length ? slugs : ["__none__"];
  return list.flatMap((slug) => Object.keys(SITUATIONS).map((situation) => ({ slug, situation })));
}

async function load(slug: string) {
  const catalog = await getPlannerCatalog();
  return { catalog, doc: catalog.documents.find((d) => d.slug === slug) ?? null };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, slug, situation } = await props.params;
  if (!isLocale(locale) || !isSituation(situation)) return {};
  const [t, { doc }] = await Promise.all([getDictionaryFor(locale), load(slug)]);
  if (!doc) return { title: t.errors.notFoundTitle, robots: { index: false } };
  const title = t.planner.situationTitle.replace("{document}", doc.name).replace("{situation}", t.planner.situations[situation]);
  return pageMetadata({ locale, path: `/ids/${slug}/${situation}`, title, description: t.planner.metaDescription, type: "article" });
}

/** SEO landing page generated from the planner, e.g. /en/ids/passport/for-8-to-5-workers. */
export default async function SituationPage(props: Props) {
  const { locale, slug, situation } = await props.params;
  if (!isLocale(locale) || !isSituation(situation)) notFound();
  const [t, { catalog, doc }, now] = await Promise.all([getDictionaryFor(locale), load(slug), cachedNow()]);
  if (!doc) notFound();

  const result = buildPlan(catalog, situationInput(doc.id, situation), { now: new Date(now), staleDays: serverEnv().CONTENT_STALE_DAYS, waitMinutes: catalog.waitMinutes });
  const situationText = t.planner.situations[situation];
  const title = t.planner.situationTitle.replace("{document}", doc.name).replace("{situation}", situationText);

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <JsonLd
        data={breadcrumbList([
          { name: t.guides.breadcrumbHome, url: absoluteUrl(`/${locale}`) },
          { name: t.guides.indexTitle, url: absoluteUrl(`/${locale}/ids`) },
          { name: doc.name, url: absoluteUrl(`/${locale}/ids/${slug}`) },
          { name: title, url: absoluteUrl(`/${locale}/ids/${slug}/${situation}`) },
        ])}
      />
      <Breadcrumbs
        label={t.nav.breadcrumb}
        items={[
          { name: t.guides.breadcrumbHome, href: `/${locale}` },
          { name: t.guides.indexTitle, href: `/${locale}/ids` },
          { name: doc.name, href: `/${locale}/ids/${slug}` },
          { name: situationText },
        ]}
      />
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="text-lg">{t.planner.situationIntro.replace("{situation}", situationText)}</p>
      <Link href={`/${locale}/lakad?goal=${slug}`} className={buttonVariants()}>
        {t.planner.makeMyOwn}
      </Link>
      {result.status === "ok" ? (
        <DiskarteView result={result} t={t.planner} days={t.offices.days} freeLabel={t.guides.feeFree} locale={locale} />
      ) : result.status === "blocked" ? (
        <Alert tone="caution">{t.planner.blocked[result.reason]}</Alert>
      ) : null}
      <p className="text-sm text-muted-foreground">{t.planner.disclaimer}</p>
    </article>
  );
}
