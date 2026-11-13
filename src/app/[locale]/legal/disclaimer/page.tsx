import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { disclaimer } from "@/content/legal/disclaimer";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.legal.disclaimerTitle };
}

export default async function DisclaimerPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return <LegalPage title={t.legal.disclaimerTitle} doc={disclaimer} locale={locale} t={t} />;
}
