/**
 * Guide page factory shared by /ids/[slug] (personal documents) and
 * /business/[slug] (registrations and permits, e.g. BIR registration).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hreflang, isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { cachedNow, getGuide, listGuideSlugs, type GuideScope } from "@/lib/content/public";
import { serverEnv } from "@/lib/env.server";
import { feeDisplay } from "@/lib/format";
import { absoluteUrl, pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbList, howTo } from "@/lib/seo/structured-data";
import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { LegalBasis } from "@/components/public/legal-basis";
import { OfficeCard } from "@/components/public/office-card";
import { ReportButton } from "@/components/public/report-button";
import { RequirementsList } from "@/components/public/requirements-list";
import { StepsList } from "@/components/public/steps-list";
import { VerificationBlock } from "@/components/public/verification-block";
import { SITUATIONS, type SituationSlug } from "@/lib/planner/situations";
import { LiveContextPanel } from "@/components/community/live-context";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function guidePage(scope: GuideScope) {
  const BASE = scope === "business" ? "business" : "ids";

// Prerender every published guide. With Cache Components at least one param is
// required, so a placeholder is used until the first guide is published.
async function generateStaticParams() {
  const slugs = await listGuideSlugs(scope);
  return (slugs.length ? slugs : ["__none__"]).map((slug) => ({ slug }));
}

async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) return {};
  const [t, guide] = await Promise.all([getDictionaryFor(locale), getGuide(slug, scope)]);
  if (!guide) return { title: t.errors.notFoundTitle, robots: { index: false } };
  return pageMetadata({
    locale,
    path: `/${BASE}/${slug}`,
    title: guide.document.name,
    description: guide.document.description ?? t.guides.indexIntro,
    type: "article",
  });
}

async function GuidePage(props: Props) {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) notFound();
  const [t, guide, now] = await Promise.all([getDictionaryFor(locale), getGuide(slug, scope), cachedNow()]);
  if (!guide) notFound();
  const sectionTitle = scope === "business" ? t.business.indexTitle : t.guides.indexTitle;

  const { document: doc, agency } = guide;
  const url = absoluteUrl(`/${locale}/${BASE}/${doc.slug}`);
  const fee = feeDisplay(doc.fee_min, doc.fee_max);
  const purposes = t.guides.purposes as Record<string, string>;
  const allItems = guide.requirementGroups.flatMap((g) => g.options.flatMap((o) => o.items));

  const processing =
    doc.processing_days_min != null && doc.processing_days_max != null
      ? doc.processing_days_min === doc.processing_days_max
        ? format(t.guides.processingDaysSingle, { days: doc.processing_days_min })
        : format(t.guides.processingDays, { min: doc.processing_days_min, max: doc.processing_days_max })
      : null;

  return (
    <article className="space-y-8">
      <JsonLd
        data={breadcrumbList([
          { name: t.guides.breadcrumbHome, url: absoluteUrl(`/${locale}`) },
          { name: sectionTitle, url: absoluteUrl(`/${locale}/${BASE}`) },
          { name: doc.name, url },
        ])}
      />
      <JsonLd
        data={howTo({
          name: doc.name,
          description: doc.description,
          url,
          inLanguage: hreflang[locale],
          steps: guide.steps.map((s) => ({ title: s.title, body: s.body_md, estimatedMinutes: s.estimated_minutes })),
          supplies: allItems.map((i) => i.requiredDocument?.name ?? i.requirement_text ?? "").filter(Boolean),
          feeMin: doc.fee_min,
          dateModified: guide.oldestVerifiedAt,
        })}
      />

      <div className="space-y-3">
        <Breadcrumbs
          label={t.nav.breadcrumb}
          items={[
            { name: t.guides.breadcrumbHome, href: `/${locale}` },
            { name: sectionTitle, href: `/${locale}/${BASE}` },
            { name: doc.name },
          ]}
        />
        {agency ? <p className="font-semibold text-muted-foreground">{format(t.guides.issuedBy, { agency: agency.name })}</p> : null}
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{doc.name}</h1>
        {doc.description ? <p className="max-w-prose text-lg">{doc.description}</p> : null}
        <VerificationBlock
          lastVerifiedAt={guide.oldestVerifiedAt}
          sourceUrl={doc.source_url}
          staleDays={serverEnv().CONTENT_STALE_DAYS}
          now={new Date(now)}
          locale={locale}
          t={t}
        />
      </div>

      <section aria-labelledby="facts" className="rounded-lg border bg-card p-4">
        <h2 id="facts" className="mb-3 text-lg font-bold">
          {t.guides.quickFacts}
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fact label={t.guides.fee}>
            {fee.kind === "unknown" ? t.guides.notStated : fee.kind === "free" ? t.guides.feeFree : fee.kind === "amount" ? fee.text : format(t.guides.feeRange, { min: fee.min, max: fee.max })}
            {doc.fee_note ? <span className="block text-sm text-muted-foreground">{doc.fee_note}</span> : null}
          </Fact>
          <Fact label={t.guides.processing}>
            {processing ?? t.guides.notStated}
            {doc.processing_note ? <span className="block text-sm text-muted-foreground">{doc.processing_note}</span> : null}
          </Fact>
          <Fact label={t.guides.validity}>
            {doc.validity_text ?? (doc.validity_months ? format(t.guides.validityMonths, { months: doc.validity_months }) : t.guides.notStated)}
          </Fact>
          {guide.acceptedFor.length ? (
            <Fact label={t.guides.acceptedFor}>
              <ul>
                {guide.acceptedFor.map((a) => (
                  <li key={a.purpose}>{purposes[a.purpose] ?? a.purpose.replace(/_/g, " ")}</li>
                ))}
              </ul>
            </Fact>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="plan" className="space-y-3 rounded-lg border-2 border-folder bg-accent p-4 text-accent-foreground">
        <h2 id="plan" className="text-lg font-bold">
          {t.planner.title}
        </h2>
        <p>{t.planner.intro}</p>
        <Link href={`/${locale}/lakad?goal=${doc.slug}`} className={buttonVariants()}>
          {t.planner.makeMyOwn}
        </Link>
        {scope === "personal" ? (
        <ul className="flex flex-wrap gap-x-4">
          {(Object.keys(SITUATIONS) as SituationSlug[]).map((s) => (
            <li key={s}>
              <Link href={`/${locale}/ids/${doc.slug}/${s}`} className="inline-flex min-h-11 items-center text-sm font-semibold underline">
                {t.planner.situationTitle.replace("{document}", doc.name).replace("{situation}", t.planner.situations[s])}
              </Link>
            </li>
          ))}
        </ul>
        ) : null}
      </section>

      <LiveContextPanel slug={doc.slug} locale={locale} t={t.liveContext} />

      {guide.requirementGroups.length ? (
        <section aria-labelledby="requirements" className="space-y-3">
          <h2 id="requirements" className="text-2xl font-bold">
            {t.guides.requirementsHeading}
          </h2>
          <p className="max-w-prose text-muted-foreground">{t.guides.requirementsIntro}</p>
          <RequirementsList groups={guide.requirementGroups} locale={locale} t={t} />
        </section>
      ) : null}

      {guide.steps.length ? (
        <section aria-labelledby="steps" className="space-y-3">
          <h2 id="steps" className="text-2xl font-bold">
            {t.guides.stepsHeading}
          </h2>
          <StepsList steps={guide.steps} t={t} />
        </section>
      ) : null}

      <section aria-labelledby="offices" className="space-y-3">
        <h2 id="offices" className="text-2xl font-bold">
          {t.guides.officesHeading}
        </h2>
        {guide.offices.length ? (
          <>
            <p className="text-muted-foreground">{t.guides.officesIntro}</p>
            <ul className="grid gap-3 md:grid-cols-2">
              {guide.offices.slice(0, 6).map((o) => (
                <li key={o.id}>
                  <OfficeCard office={o} locale={locale} t={t.offices} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground">{t.guides.officesEmpty}</p>
        )}
        <Link href={`/${locale}/offices?document=${doc.slug}`} className={buttonVariants({ variant: "outline" })}>
          {t.guides.allOfficesLink}
        </Link>
      </section>

      <section aria-labelledby="legal" className="space-y-3">
        <h2 id="legal" className="text-2xl font-bold">
          {t.guides.legalHeading}
        </h2>
        <p className="text-muted-foreground">{t.guides.legalIntro}</p>
        <LegalBasis items={guide.legal} locale={locale} t={t} />
      </section>

      {guide.sources.length ? (
        <section aria-labelledby="sources" className="space-y-2">
          <h2 id="sources" className="text-lg font-bold">
            {t.guides.sourcesHeading}
          </h2>
          <ul className="space-y-1">
            {guide.sources.map((s) => (
              <li key={s}>
                <a href={s} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all text-primary underline">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link href={`/${locale}/chika?doc=${doc.slug}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline">
        {t.chika.askAbout}
      </Link>
      <ReportButton targetType="document" targetId={doc.id} t={t.report} signInHref={`/${locale}/login`} signInLabel={t.nav.signIn} />
      <p className="text-sm text-muted-foreground">{t.guides.disclaimer}</p>
    </article>
  );
}

  return { generateStaticParams, generateMetadata, GuidePage };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}
