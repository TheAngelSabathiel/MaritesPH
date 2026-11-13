"use client";

/**
 * Sign-in form: email magic link or Google. A consent checkbox (RA 10173) must
 * be ticked before either option works. Consent is recorded server-side after
 * the redirect (see src/lib/auth/finish-sign-in.ts).
 */
import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import * as z from "zod/mini";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export type LoginStrings = {
  emailLabel: string;
  emailPlaceholder: string;
  sendLink: string;
  sending: string;
  or: string;
  google: string;
  consentLabel: string;
  privacyLink: string;
  termsLink: string;
  consentRequired: string;
  invalidEmail: string;
  checkEmailTitle: string;
  checkEmailBody: string;
  genericError: string;
};

const emailSchema = z.email();

/** Replace {privacy} and {terms} in the consent sentence with links. */
function withLinks(template: string, links: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    return key && key in links ? <span key={i}>{links[key]}</span> : part;
  });
}

export function LoginForm({
  locale,
  consentVersion,
  t,
}: {
  locale: string;
  consentVersion: string;
  t: LoginStrings;
}) {
  const consentId = useId();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  function callbackUrl() {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", `/${locale}/account`);
    url.searchParams.set("consent", consentVersion);
    return url.toString();
  }

  function checkConsent(): boolean {
    if (!consent) {
      setError(t.consentRequired);
      return false;
    }
    return true;
  }

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!checkConsent()) return;
    const parsed = z.safeParse(emailSchema, email.trim());
    if (!parsed.success) {
      setError(t.invalidEmail);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError(t.genericError);

    setState("sending");
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: callbackUrl(), data: { language_pref: locale } },
    });
    if (otpError) {
      setState("idle");
      setError(t.genericError);
      return;
    }
    setState("sent");
  }

  async function signInWithGoogle() {
    setError(null);
    if (!checkConsent()) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError(t.genericError);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (oauthError) setError(t.genericError);
  }

  if (state === "sent") {
    return (
      <Alert tone="success">
        <p className="font-bold">{t.checkEmailTitle}</p>
        <p>{t.checkEmailBody.replace("{email}", email.trim())}</p>
      </Alert>
    );
  }

  return (
    <form onSubmit={sendMagicLink} className="space-y-5" noValidate>
      <div className="flex items-start gap-3 rounded-md border bg-muted p-3">
        <input
          id={consentId}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
          aria-describedby={error ? `${consentId}-error` : undefined}
        />
        <label htmlFor={consentId} className="text-sm leading-relaxed">
          {withLinks(t.consentLabel, {
            privacy: (
              <Link href={`/${locale}/legal/privacy`} className="font-semibold underline" target="_blank">
                {t.privacyLink}
              </Link>
            ),
            terms: (
              <Link href={`/${locale}/legal/terms`} className="font-semibold underline" target="_blank">
                {t.termsLink}
              </Link>
            ),
          })}
        </label>
      </div>

      <div className="space-y-2">
        <Label htmlFor={emailId}>{t.emailLabel}</Label>
        <Input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {error ? (
        <p id={`${consentId}-error`} role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={state === "sending"}>
        {state === "sending" ? t.sending : t.sendLink}
      </Button>

      <p className="text-center text-sm text-muted-foreground">{t.or}</p>

      <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle}>
        {t.google}
      </Button>
    </form>
  );
}
