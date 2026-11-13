import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { freelancerAccess } from "@/lib/freelancer/access";
import { DEFAULT_PROFILE, getMyProfile } from "@/lib/freelancer/data";
import { ProfileForm } from "@/components/freelancer/profile-form";
import { SignInPrompt, UpgradePrompt } from "@/components/freelancer/require";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProfilePage(props: PageProps<"/[locale]/freelancer/profile">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionaryFor(locale);
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">{t.freelancer.profile.title}</h1>
      <Suspense fallback={<p className="text-muted-foreground">{t.brand.loading}</p>}><Body locale={locale} t={t} /></Suspense>
    </>
  );
}

async function Body({ locale, t }: { locale: string; t: Messages }) {
  const access = await freelancerAccess();
  if (access.status === "signin") return <SignInPrompt text={t.freelancer.signIn} href={`/${locale}/login`} label={t.nav.signIn} />;
  if (access.status === "upgrade") return <UpgradePrompt text={t.billing.upgradeFreelancer} href={`/${locale}/pricing`} label={t.billing.seePlans} />;
  const profile = (await getMyProfile(access.userId)) ?? DEFAULT_PROFILE;
  return <ProfileForm profile={profile} locale={locale} t={t.freelancer} />;
}
