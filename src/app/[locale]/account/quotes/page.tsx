import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { formatPhDate } from "@/lib/content/freshness";
import { formatPeso } from "@/lib/format";
import { cancelQuote, completeQuote, leaveReview, respondQuote } from "@/lib/marketplace/actions";
import { myQuotes, type QuoteRow } from "@/lib/marketplace/data";
import { getCurrentUserClaims } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { robots: { index: false, follow: false } };
type Props = PageProps<"/[locale]/account/quotes">;

export default function QuotesPage(props: Props) {
  return <div className="mx-auto max-w-2xl space-y-6"><Suspense fallback={null}><Body params={props.params} searchParams={props.searchParams} /></Suspense></div>;
}

async function Body({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getCurrentUserClaims();
  if (!user) redirect(`/${locale}/login`);
  const [t, q, sp] = await Promise.all([getDictionaryFor(locale), myQuotes(user.id), searchParams]);
  const m = t.market;
  const err = sp.error === "contact" || sp.error === "update" ? sp.error : null;
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">{m.quotesTitle}</h1>
      {sp.sent ? <Alert tone="success">{m.sentNotice}</Alert> : null}
      {err ? <Alert tone="caution">{m.errors[err]}</Alert> : null}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">{m.sentTitle}</h2>
        {q.sent.length === 0 ? <p className="text-muted-foreground">{m.none}</p> : q.sent.map((r) => <Card key={r.id} r={r} locale={locale} m={m} who={q.names.get(r.cpa_user_id) ?? ""} contact={q.contacts.get(r.id)?.cpa_email} side="requester" reviewed={q.reviewed.has(r.id)} />)}
      </section>
      {q.received.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">{m.receivedTitle}</h2>
          {q.received.map((r) => <Card key={r.id} r={r} locale={locale} m={m} who="" contact={q.contacts.get(r.id)?.requester_email} side="pro" reviewed />)}
        </section>
      ) : null}
    </>
  );
}

function Card({ r, locale, m, who, contact, side, reviewed }: { r: QuoteRow; locale: Locale; m: Messages["market"]; who: string; contact?: string; side: "requester" | "pro"; reviewed: boolean }) {
  const hidden = (<><input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={r.id} /></>);
  return (
    <article className="space-y-2 rounded-lg border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground">{formatPhDate(r.created_at, locale)} · {m.services[r.service as keyof typeof m.services] ?? r.service} · {m.status[r.status as keyof typeof m.status]}</p>
      {who ? <p className="font-bold">{who}</p> : null}
      <p className="whitespace-pre-line break-words">{r.message}</p>
      {r.cpa_reply ? <p className="rounded-md bg-muted/60 p-2 text-sm"><span className="font-semibold">{m.reply}: </span>{r.cpa_reply}</p> : null}
      {r.quoted_fee_php != null ? <p className="text-sm">{m.quotedFee.replace("{fee}", formatPeso(Number(r.quoted_fee_php)))}</p> : null}
      {r.final_fee_php != null ? <p className="text-sm">{m.finalFee.replace("{fee}", formatPeso(Number(r.final_fee_php)))}</p> : null}
      {contact ? <p className="text-sm font-semibold">{m.contacts.replace("{email}", contact)}</p> : null}

      {side === "requester" && r.status === "open" ? <form action={cancelQuote}>{hidden}<Button type="submit" size="sm" variant="ghost">{m.cancel}</Button></form> : null}
      {side === "requester" && r.status === "completed" && !reviewed ? (
        <form action={leaveReview} className="space-y-2 border-t pt-2">{hidden}<input type="hidden" name="cpaUserId" value={r.cpa_user_id} />
          <p className="font-semibold">{m.reviewTitle}</p>
          <label className="block space-y-1 text-sm"><span>{m.ratingLabel}</span><select name="rating" defaultValue="5" className="flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select></label>
          <label className="block space-y-1 text-sm"><span>{m.commentLabel}</span><Input name="comment" maxLength={600} /></label>
          <Button type="submit" size="sm">{m.submitReview}</Button>
        </form>
      ) : null}
      {side === "requester" && r.status === "completed" && reviewed ? <p className="text-sm text-stamp">{m.reviewed}</p> : null}

      {side === "pro" && r.status === "open" ? (
        <form action={respondQuote} className="space-y-2 border-t pt-2">{hidden}
          <label className="block space-y-1 text-sm"><span>{m.replyLabel}</span><textarea name="reply" rows={3} maxLength={1500} className="flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-base" /></label>
          <label className="block space-y-1 text-sm"><span>{m.feeLabel}</span><Input name="fee" inputMode="decimal" /></label>
          <div className="flex gap-2"><Button type="submit" size="sm" name="decision" value="accepted">{m.accept}</Button><Button type="submit" size="sm" variant="outline" name="decision" value="declined">{m.decline}</Button></div>
        </form>
      ) : null}
      {side === "pro" && r.status === "accepted" ? (
        <form action={completeQuote} className="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:items-end">{hidden}
          <label className="flex-1 space-y-1 text-sm"><span>{m.completeLabel}</span><Input name="fee" inputMode="decimal" required /></label>
          <Button type="submit" size="sm">{m.complete}</Button>
        </form>
      ) : null}
    </article>
  );
}
