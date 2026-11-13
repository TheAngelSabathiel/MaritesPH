import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: PageProps<"/[locale]/freelancer">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionaryFor(locale);
  return pageMetadata({ locale, path: "/freelancer", title: t.freelancer.title, description: t.freelancer.intro });
}

/** Marites Freelancer hub (static). The tools behind it need sign-in. */
export default async function FreelancerHub(props: PageProps<"/[locale]/freelancer">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = (await getDictionaryFor(locale)).freelancer;
  const base = `/${locale}/freelancer`;
  const items = [
    [`${base}/tracker`, t.links.tracker, t.linkHints.tracker],
    [`${base}/tax`, t.links.tax, t.linkHints.tax],
    [`${base}/calendar`, t.links.calendar, t.linkHints.calendar],
    [`${base}/profile`, t.links.profile, t.linkHints.profile],
    [`/${locale}/business`, t.links.guides, t.linkHints.guides],
  ];
  return (
    <>
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h1>
        <p className="text-lg">{t.intro}</p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map(([href, label, hint]) => (
          <li key={href}><Link href={href} className="block h-full rounded-lg border bg-card p-4 active:bg-muted"><span className="block text-lg font-bold text-primary">{label}</span><span className="text-sm text-muted-foreground">{hint}</span></Link></li>
        ))}
      </ul>
    </>
  );
}
