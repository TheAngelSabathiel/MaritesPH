import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { getPlannerCatalog } from "@/lib/content/public";
import { pageMetadata } from "@/lib/seo/metadata";
import { ChikaFormFromUrl } from "@/components/community/chika-form";

export async function generateMetadata(props: PageProps<"/[locale]/chika">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionaryFor(locale);
  return pageMetadata({ locale, path: "/chika", title: t.chika.title, description: t.chika.intro });
}

/** Chika sa Pila: community troubleshooter. Static page; answers come from a Server Action. */
export default async function ChikaPage(props: PageProps<"/[locale]/chika">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const [t, catalog] = await Promise.all([getDictionaryFor(locale), getPlannerCatalog()]);
  const documents = catalog.documents.map(({ id, slug, name }) => ({ id, slug, name }));
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.chika.title}</h1>
        <p className="text-lg">{t.chika.intro}</p>
        <p className="text-sm font-semibold text-muted-foreground">{t.chika.notOfficial}</p>
      </header>
      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 font-semibold text-muted-foreground">{t.guides.indexEmpty}</p>
      ) : (
        <ChikaFormFromUrl documents={documents} locale={locale} t={t.chika} signInHref={`/${locale}/login`} signInLabel={t.nav.signIn} />
      )}
    </div>
  );
}
