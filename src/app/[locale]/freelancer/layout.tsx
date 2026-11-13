import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { Alert } from "@/components/ui/alert";

/** Marites Freelancer shell: section tabs, preview note, and the tax disclaimer on every page. */
export default async function FreelancerLayout(props: LayoutProps<"/[locale]/freelancer">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = (await getDictionaryFor(locale)).freelancer;
  const base = `/${locale}/freelancer`;
  const tabs = [
    [base, t.title],
    [`${base}/tracker`, t.links.tracker],
    [`${base}/tax`, t.links.tax],
    [`${base}/calendar`, t.links.calendar],
    [`${base}/profile`, t.links.profile],
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <nav aria-label={t.title} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-1 border-b">
          {tabs.map(([href, label]) => (
            <li key={href}><Link href={href} className="inline-flex min-h-11 items-center whitespace-nowrap px-3 text-sm font-semibold hover:text-primary">{label}</Link></li>
          ))}
        </ul>
      </nav>
      <p className="text-sm font-semibold text-muted-foreground">{t.preview}</p>
      {props.children}
      <Alert tone="info">{t.disclaimer}</Alert>
    </div>
  );
}
