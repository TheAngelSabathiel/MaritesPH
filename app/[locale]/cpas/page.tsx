import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { listDirectory } from "@/lib/marketplace/data";
import { pageMetadata } from "@/lib/seo/metadata";
import { Alert } from "@/components/ui/alert";
import { Directory } from "@/components/market/directory";

export async function generateMetadata(props: PageProps<"/[locale]/cpas">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionaryFor(locale);
  return pageMetadata({ locale, path: "/cpas", title: t.market.title, description: t.market.intro });
}

/** Public directory of verified professionals (static, cached). */
export default async function CpasPage(props: PageProps<"/[locale]/cpas">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const [t, list] = await Promise.all([getDictionaryFor(locale), listDirectory()]);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.market.title}</h1>
        <p className="text-lg">{t.market.intro}</p>
      </header>
      <Alert tone="info">{t.market.disclaimer}</Alert>
      <Directory list={list} locale={locale} t={t.market} />
      <Link href={`/${locale}/account/listing`} className="inline-flex min-h-11 items-center font-semibold text-primary underline">{t.market.becomePro}</Link>
    </div>
  );
}
