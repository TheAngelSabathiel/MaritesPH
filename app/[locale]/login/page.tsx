import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { getSupabasePublicConfig } from "@/lib/env";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { LoginError } from "./login-error";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  // Sign-in pages have no search value.
  return { title: t.auth.title, robots: { index: false, follow: false } };
}

export default async function LoginPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const configured = getSupabasePublicConfig() !== null;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{t.auth.title}</h1>
        <p>{t.auth.intro}</p>
      </div>
      {/* ?error= is request data, so it streams in behind its own boundary. */}
      <Suspense fallback={null}>
        <LoginError message={t.auth.callbackError} />
      </Suspense>
      <Card>
        <CardContent>
          {configured ? (
            <LoginForm locale={locale} consentVersion={PRIVACY_POLICY_VERSION} t={t.auth} />
          ) : (
            <Alert tone="caution">{t.auth.notConfigured}</Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
