"use client";

/**
 * Chika sa Pila form + result. Results are community experience: labeled
 * unverified, every claim with its source link and date, plus the official
 * channel to contact. Plain wording inside results (voice rules).
 */
import { Suspense, useActionState, useId } from "react";
import { useSearchParams } from "next/navigation";
import type { Messages } from "@/i18n/dictionaries";
import { askChika, type ChikaState } from "@/lib/community/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type T = Messages["chika"];
const fieldClass = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base";

export function ChikaForm({ documents, locale, initialDocument, t, signInHref, signInLabel }: { documents: { id: string; slug: string; name: string }[]; locale: "en" | "fil"; initialDocument?: string; t: T; signInHref: string; signInLabel: string }) {
  const [state, action, pending] = useActionState<ChikaState, FormData>(askChika, { status: "idle" });
  const id = useId();
  const fmt = new Intl.DateTimeFormat(locale === "fil" ? "fil-PH" : "en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4 rounded-lg border bg-card p-4">
        <input type="hidden" name="locale" value={locale} />
        <div className="space-y-2">
          <label htmlFor={`${id}-doc`} className="text-sm font-semibold">{t.documentLabel}</label>
          <select id={`${id}-doc`} name="documentId" defaultValue={documents.find((d) => d.slug === initialDocument)?.id ?? ""} required className={fieldClass}>
            <option value="" disabled>—</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor={`${id}-p`} className="text-sm font-semibold">{t.problemLabel}</label>
          <textarea id={`${id}-p`} name="problem" required minLength={10} maxLength={500} rows={4} placeholder={t.problemPlaceholder} className={`${fieldClass} min-h-24`} />
          <p className="text-sm text-muted-foreground">{t.problemHint}</p>
        </div>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? t.working : t.submit}</Button>
      </form>

      {state.status === "ok" ? (
        <section aria-labelledby="chika-result" className="space-y-4 rounded-lg border-2 border-dashed border-folder bg-card p-4">
          <p className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{t.label}</p>
          <p className="text-sm text-muted-foreground">{t.notOfficial}</p>
          <div>
            <h2 id="chika-result" className="text-lg font-bold">{t.summaryHeading}</h2>
            <p>{state.result.summary}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.confidence[state.result.confidence]}
              {state.result.recency ? ` · ${t.recency.replace("{text}", state.result.recency)}` : ""}
            </p>
          </div>
          {state.result.causes.length ? (
            <div>
              <h3 className="font-bold">{t.causesHeading}</h3>
              <ul className="list-disc pl-5">{state.result.causes.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          ) : null}
          <div>
            <h3 className="font-bold">{t.resolutionsHeading}</h3>
            <ol className="space-y-3">
              {state.result.resolutions.map((r) => (
                <li key={r.text} className="rounded-md bg-muted/60 p-3">
                  <p>{r.text}</p>
                  {r.officialChannel ? <p className="text-sm font-semibold">{t.officialChannel.replace("{channel}", r.officialChannel)}</p> : null}
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{t.sources}</p>
                  <ul>
                    {r.sources.map((s) => (
                      <li key={s.url}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center break-all text-sm text-primary underline">
                          {s.title || s.url}
                        </a>
                        {s.date ? <span className="text-xs text-muted-foreground"> ({s.date})</span> : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
          {state.result.officialGuidance ? (
            <div className="rounded-md border border-stamp/40 bg-stamp-soft p-3">
              <h3 className="font-bold">{t.officialGuidanceHeading}</h3>
              <p>{state.result.officialGuidance}</p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {state.cached ? `${t.cached} ` : ""}
            {t.generatedOn.replace("{date}", fmt.format(new Date(state.result.generatedAt)))}
          </p>
        </section>
      ) : state.status !== "idle" ? (
        <Alert tone="caution">
          {t.states[state.status]}
          {state.status === "signin" ? (
            <> <a href={signInHref} className="inline-flex min-h-11 items-center font-semibold underline">{signInLabel}</a></>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}

/** Reads ?doc=<slug> to preselect the document (inside Suspense; plain form until then). */
export function ChikaFormFromUrl(props: Omit<Parameters<typeof ChikaForm>[0], "initialDocument">) {
  return (
    <Suspense fallback={<ChikaForm {...props} />}>
      <WithParam {...props} />
    </Suspense>
  );
}
function WithParam(props: Omit<Parameters<typeof ChikaForm>[0], "initialDocument">) {
  const doc = useSearchParams().get("doc") ?? undefined;
  return <ChikaForm {...props} initialDocument={doc} key={doc ?? "none"} />;
}
