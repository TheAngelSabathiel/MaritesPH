import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { formatPhDate } from "@/lib/content/freshness";
import { formatPeso } from "@/lib/format";
import { requestQuote } from "@/lib/marketplace/actions";
import { listDirectory, listReviews } from "@/lib/marketplace/data";
import { SERVICES } from "@/lib/marketplace/rules";
import { getCurrentUserClaims } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignInPrompt } from "@/components/freelancer/require";

export const metadata: Metadata = { robots: { index: true, follow: true } };
type Props = PageProps<"/[locale]/cpas/[id]">;
const QUOTE_KEYS = ["invalid", "contact", "limited", "error"] as const;

/** Professional profile (request-time: everything inside Suspense). */
export default function CpaProfilePage(props: Props) {
  return <div className="mx-auto max-w-2xl space-y-5"><Suspense fallback={null}><Profile params={props.params} searchParams={props.searchParams} /></Suspense></div>;
}

async function Profile({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, list, user, sp] = await Promise.all([getDictionaryFor(locale), listDirectory(), getCurrentUserClaims(), searchParams]);
  const m = t.market;
  const e = list.find((x) => x.user_id === id);
  if (!e) notFound();
  const reviews = await listReviews(id);
  const status = QUOTE_KEYS.find((k) => k === sp.quote);
  return (
    <>
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">{e.display_name}</h1>
        <p className="text-muted-foreground">{m.profession[e.profession]}{e.firm_name ? ` · ${e.firm_name}` : ""}</p>
        <p className="text-sm font-semibold text-stamp">{m.verified.replace("{date}", formatPhDate(e.verified_at, locale))}</p>
        {e.prc_license_no ? <p className="text-sm">{m.license.replace("{no}", e.prc_license_no)}{e.license_valid_until ? `, ${m.validUntil.replace("{date}", formatPhDate(e.license_valid_until, locale))}` : ""}</p> : null}
        <p className="text-sm">{e.rating_count ? m.rating.replace("{avg}", String(e.rating_avg)).replace("{n}", String(e.rating_count)) : m.noRating}</p>
      </header>
      {e.bio ? <p className="whitespace-pre-line">{e.bio}</p> : null}
      <p className="text-sm">{e.services.map((s) => m.services[s]).join(", ")}</p>
      <p className="text-sm text-muted-foreground">{[e.cities.join(", "), e.online_only ? m.online : null].filter(Boolean).join(" · ")}</p>
      {e.starting_fee_php != null ? <p className="font-semibold">{m.startingAt.replace("{fee}", formatPeso(e.starting_fee_php))}</p> : null}
      <Alert tone="info">{m.disclaimer}</Alert>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-xl font-bold">{m.requestTitle}</h2>
        {status ? <Alert tone="caution">{m.quoteStatus[status]}</Alert> : null}
        {!user ? <SignInPrompt text={m.signInToRequest} href={`/${locale}/login`} label={t.nav.signIn} /> : user.id === id ? <p className="text-muted-foreground">{m.ownListing}</p> : (
          <form action={requestQuote} className="space-y-3">
            <p className="text-sm text-muted-foreground">{m.requestIntro}</p>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="cpaUserId" value={id} />
            <label className="block space-y-1 text-sm"><span className="font-semibold">{m.service}</span>
              <select name="service" required className="flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base">{SERVICES.filter((s) => e.services.includes(s)).map((s) => <option key={s} value={s}>{m.services[s]}</option>)}</select>
            </label>
            <label className="block space-y-1 text-sm"><span className="font-semibold">{m.message}</span>
              <textarea name="message" required minLength={20} maxLength={1500} rows={5} className="flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-base" />
              <span className="text-muted-foreground">{m.messageHint}</span>
            </label>
            <label className="block space-y-1 text-sm"><span className="font-semibold">{m.city}</span><Input name="city" maxLength={80} /></label>
            <Button type="submit" className="w-full sm:w-auto">{m.send}</Button>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">{m.reviews}</h2>
        {reviews.length === 0 ? <p className="text-muted-foreground">{m.noRating}</p> : (
          <ul className="divide-y rounded-lg border bg-card">{reviews.map((r, i) => <li key={i} className="p-3"><p className="font-semibold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>{r.comment ? <p className="break-words">{r.comment}</p> : null}<p className="text-xs text-muted-foreground">{formatPhDate(r.created_at, locale)}</p></li>)}</ul>
        )}
      </section>
    </>
  );
}
