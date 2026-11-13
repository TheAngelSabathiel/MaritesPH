import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { privacyPolicy } from "@/content/legal/privacy";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.legal.privacyTitle };
}

export default async function PrivacyPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return <LegalPage title={t.legal.privacyTitle} doc={privacyPolicy} version={PRIVACY_POLICY_VERSION} locale={locale} t={t} />;
}
