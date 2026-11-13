import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Messages } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { formatPhDate } from "@/lib/content/freshness";
import { publicEnv } from "@/lib/env";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";
import { PROFILE_COLUMNS, profileSchema } from "@/lib/profiles/schema";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { giveConsent } from "./actions";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { DeleteAccount } from "@/components/me/delete-account";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.account.title, robots: { index: false, follow: false } };
}

export default async function AccountPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.account.title}</h1>
      <Suspense fallback={<p className="text-muted-foreground">{t.brand.loading}</p>}>
        <AccountDetails locale={locale} t={t} />
      </Suspense>
    </div>
  );
}

async function AccountDetails({ locale, t }: { locale: Locale; t: Messages }) {
  const user = await getCurrentUserClaims();
  if (!user) redirect(`/${locale}/login`);

  const supabase = await createSupabaseServerClient();
  const { data } = supabase
    ? await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle()
    : { data: null };
  const parsed = profileSchema.safeParse(data);
  const profile = parsed.success ? parsed.data : null;
  const consentCurrent = profile?.privacy_consent_version === PRIVACY_POLICY_VERSION;

  return (
    <>
      <p>{format(t.account.signedInAs, { email: user.email ?? "" })}</p>
      <nav className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/${locale}/my-documents`} className={buttonVariants({ variant: "outline" })}>
          {t.nav.myDocuments}
        </Link>
        <Link href={`/${locale}/plans`} className={buttonVariants({ variant: "outline" })}>
          {t.nav.myPlans}
        </Link>
        <Link href={`/${locale}/account/billing`} className={buttonVariants({ variant: "outline" })}>
          {t.billing.title}
        </Link>
        <Link href={`/${locale}/account/quotes`} className={buttonVariants({ variant: "outline" })}>
          {t.market.quotesTitle}
        </Link>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>{t.account.consentHeading}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {consentCurrent && profile?.privacy_consent_at ? (
            <Alert tone="success">
              {format(t.account.consentGiven, {
                version: profile.privacy_consent_version ?? "",
                date: formatPhDate(profile.privacy_consent_at, locale),
              })}
            </Alert>
          ) : (
            <form action={giveConsent} className="space-y-3">
              <Alert tone="caution">{t.account.consentMissing}</Alert>
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit">{t.account.consentButton}</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.account.profileHeading}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="font-semibold">{t.account.displayName}</dt>
            <dd>{profile?.display_name ?? t.account.notSet}</dd>
            <dt className="font-semibold">{t.account.language}</dt>
            <dd>{profile?.language_pref === "fil" ? "Filipino" : "English"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.account.dataRightsHeading}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p>{format(t.account.dataRightsBody, { email: publicEnv.NEXT_PUBLIC_CONTACT_EMAIL })}</p>
          <div className="space-y-2">
            <a href="/api/account/export" className={buttonVariants({ variant: "outline" })} download>
              {t.dataRights.exportButton}
            </a>
            <p className="text-sm text-muted-foreground">{t.dataRights.exportHint}</p>
          </div>
          <DeleteAccount locale={locale} email={publicEnv.NEXT_PUBLIC_CONTACT_EMAIL} t={t.dataRights} />
        </CardContent>
      </Card>

      <form action="/auth/signout" method="post">
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" variant="outline">
          {t.nav.signOut}
        </Button>
      </form>
    </>
  );
}
