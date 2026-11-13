import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { listGuides } from "@/lib/content/public";
import { buttonVariants } from "@/components/ui/button";
import { format } from "@/i18n/format";
import { formatPhDate } from "@/lib/content/freshness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifiedStamp } from "@/components/verified-stamp";

/**
 * Home page. States no government facts itself: it links to published guides
 * (only verified content is ever published) or says guides are on the way.
 */
export default async function HomePage() {
  const [t, locale, guides] = await Promise.all([getDictionary(), getLocale(), listGuides()]);

  return (
    <div className="space-y-12">
      <section className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div className="space-y-4">
          <p className="text-lg font-semibold text-muted-foreground">{t.brand.promise}</p>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {t.brand.greeting}
          </h1>
          <p className="max-w-prose text-lg">{t.home.intro}</p>
        </div>

        {/* The stamp is shown as a labeled SAMPLE: no real date or source yet. */}
        <figure className="rounded-lg border bg-accent p-6 text-accent-foreground">
          <VerifiedStamp
            label={t.features.verifiedBadge}
            dateText={format(t.verification.lastVerified, { date: formatPhDate("2026-11-11", locale) })}
            sampleLabel={t.verification.sample}
            className="bg-card"
          />
          <figcaption className="mt-4 text-sm">{t.home.sampleStampCaption}</figcaption>
        </figure>
      </section>

      <section aria-labelledby="pillars" className="space-y-4">
        <h2 id="pillars" className="text-2xl font-bold tracking-tight">
          {t.home.pillarsHeading}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-stamp">
            <CardHeader>
              <CardTitle>{t.home.pillarVerifiedTitle}</CardTitle>
            </CardHeader>
            <CardContent>{t.home.pillarVerifiedBody}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t.home.pillarPlanTitle}</CardTitle>
              <p className="text-sm font-semibold text-muted-foreground">{t.features.wizard}</p>
            </CardHeader>
            <CardContent>{t.home.pillarPlanBody}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t.home.pillarCommunityTitle}</CardTitle>
              <p className="text-sm font-semibold text-muted-foreground">{t.features.community}</p>
            </CardHeader>
            <CardContent>{t.home.pillarCommunityBody}</CardContent>
          </Card>
        </div>
      </section>

      {guides.length ? (
        <section aria-labelledby="guides" className="space-y-4">
          <h2 id="guides" className="text-2xl font-bold tracking-tight">
            {t.guides.indexTitle}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {guides.slice(0, 6).map((g) => (
              <li key={g.id}>
                <Link href={`/${locale}/ids/${g.slug}`} className="block h-full rounded-lg border bg-card p-4 font-bold text-primary active:bg-muted">
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={`/${locale}/ids`} className={buttonVariants()}>
              {t.nav.guides}
            </Link>
            <Link href={`/${locale}/offices`} className={buttonVariants({ variant: "outline" })}>
              {t.nav.offices}
            </Link>
          </div>
        </section>
      ) : (
        <section aria-labelledby="status" className="rounded-lg border border-dashed p-6">
          <h2 id="status" className="text-xl font-bold">
            {t.home.statusHeading}
          </h2>
          <p className="mt-2 max-w-prose">{t.home.statusBody}</p>
          <p className="mt-3 font-semibold text-muted-foreground">{t.brand.comingSoon}</p>
        </section>
      )}
    </div>
  );
}
