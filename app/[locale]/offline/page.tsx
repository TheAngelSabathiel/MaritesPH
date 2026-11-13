import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Shown by the service worker when there's no connection and no saved copy of the page. */
export default async function OfflinePage(props: PageProps<"/[locale]/offline">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = (await getDictionaryFor(locale)).offline;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
      <p className="text-lg">{t.body}</p>
      <ul className="list-disc space-y-1 pl-5">{t.works.map((w) => <li key={w}>{w}</li>)}</ul>
      <Link href={`/${locale}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline">{t.retry}</Link>
    </div>
  );
}
