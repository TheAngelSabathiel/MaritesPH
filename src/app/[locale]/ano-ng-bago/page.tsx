import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { listFeed } from "@/lib/content/public";
import { pageMetadata } from "@/lib/seo/metadata";
import { FeedList } from "@/components/feed/feed-list";

export async function generateMetadata(props: PageProps<"/[locale]/ano-ng-bago">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionaryFor(locale);
  return pageMetadata({ locale, path: "/ano-ng-bago", title: t.feed.title, description: t.feed.intro });
}

/** Public feed of approved changes and published official issuances. Static; refreshed when admins approve. */
export default async function FeedPage(props: PageProps<"/[locale]/ano-ng-bago">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const [t, items] = await Promise.all([getDictionaryFor(locale), listFeed()]);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.feed.title}</h1>
        <p className="text-lg">{t.feed.intro}</p>
        <p className="text-sm text-muted-foreground">{t.feed.howItWorks}</p>
      </header>
      <FeedList items={items} locale={locale} t={t.feed} />
    </div>
  );
}
