import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { getPlannerCatalog } from "@/lib/content/public";
import { wizardData } from "@/lib/planner/wizard-data";
import { pageMetadata } from "@/lib/seo/metadata";
import { PlannerWizard } from "@/components/planner/wizard";
import { aiSettings } from "@/lib/ai/config";

export async function generateMetadata(props: PageProps<"/[locale]/lakad">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionaryFor(locale);
  return pageMetadata({ locale, path: "/lakad", title: t.planner.title, description: t.planner.metaDescription });
}

/** "Ano'ng Lakad Mo?" The page is static; plans are computed on request by a Server Action. */
export default async function PlannerPage(props: PageProps<"/[locale]/lakad">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const [t, catalog] = await Promise.all([getDictionaryFor(locale), getPlannerCatalog()]);
  const data = wizardData(catalog, t.guides.purposes as Record<string, string>);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.planner.title}</h1>
        <p className="text-lg">{t.planner.intro}</p>
      </header>
      {data.documents.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 font-semibold text-muted-foreground">{t.guides.indexEmpty}</p>
      ) : (
        <PlannerWizard data={data} locale={locale} t={t.planner} days={t.offices.days} freeLabel={t.guides.feeFree} ai={{ enabled: aiSettings().enabled, t: t.aiSummary }} />
      )}
    </div>
  );
}
