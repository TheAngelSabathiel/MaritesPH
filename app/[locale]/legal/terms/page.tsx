import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { termsOfUse } from "@/content/legal/terms";
import { TERMS_VERSION } from "@/lib/legal";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.legal.termsTitle };
}

export default async function TermsPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return <LegalPage title={t.legal.termsTitle} doc={termsOfUse} version={TERMS_VERSION} locale={locale} t={t} />;
}
