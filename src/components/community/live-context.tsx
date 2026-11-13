"use client";

/**
 * "Ano'ng bago?" panel on guide pages. Loads after the page (the guide itself
 * stays static and fast). Official updates and community experience are shown
 * in separate, labeled groups and never change the guide's requirements.
 * A possible conflict shows a warning banner (the server also flags it for review).
 */
import { useEffect, useState } from "react";
import type { Messages } from "@/i18n/dictionaries";
import type { LiveContext } from "@/lib/context/live";
import { Alert } from "@/components/ui/alert";

type Payload = LiveContext & { conflict: boolean };

export function LiveContextPanel({ slug, locale, t }: { slug: string; locale: "en" | "fil"; t: Messages["liveContext"] }) {
  const [data, setData] = useState<Payload | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/context?type=document&slug=${encodeURIComponent(slug)}&locale=${locale}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Payload | null) => active && setData(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug, locale]);

  // Nothing known yet (AI off and no cache): render nothing rather than an empty box.
  if (!data || (!data.official && !data.community)) return null;
  const fmt = new Intl.DateTimeFormat(locale === "fil" ? "fil-PH" : "en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
  const checked = (iso: string) => t.checked.replace("{date}", fmt.format(new Date(iso)));

  return (
    <section aria-labelledby="ano-ng-bago" className="space-y-4">
      {data.conflict ? (
        <Alert tone="caution">
          <p className="font-bold">{t.conflictBanner}</p>
          <p>{t.conflictBody}</p>
        </Alert>
      ) : null}
      <h2 id="ano-ng-bago" className="text-2xl font-bold">{t.heading}</h2>
      <p className="text-muted-foreground">{t.intro}</p>

      {data.official ? (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <h3 className="font-bold">{t.officialHeading}</h3>
          {data.official.items.length === 0 ? <p className="text-sm text-muted-foreground">{t.officialEmpty}</p> : null}
          <ul className="space-y-3">
            {data.official.items.map((i) => (
              <li key={i.url} className={i.conflicts ? "rounded-md bg-caution-soft p-3" : "p-1"}>
                <p className="text-sm font-semibold text-muted-foreground">{[i.issuingBody, i.issuanceNumber, i.date ? t.issued.replace("{date}", i.date) : null].filter(Boolean).join(", ")}</p>
                <p className="font-semibold">{i.title}</p>
                {i.summary ? <p className="text-sm">{i.summary}</p> : null}
                {i.conflicts && i.conflictNote ? <p className="text-sm font-semibold text-caution">{i.conflictNote}</p> : null}
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{t.openSource}</a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{checked(data.official.fetchedAt)}{data.official.stale ? ` ${t.stale}` : ""}</p>
        </div>
      ) : null}

      {data.community ? (
        <div className="space-y-2 rounded-lg border-2 border-dashed border-folder bg-card p-4">
          <h3 className="font-bold">{t.communityHeading}</h3>
          {data.community.items.length === 0 ? <p className="text-sm text-muted-foreground">{t.communityEmpty}</p> : null}
          <ul className="space-y-2">
            {data.community.items.map((i) => (
              <li key={i.url}>
                <p className="text-sm">{i.summary}{i.date ? <span className="text-muted-foreground"> ({i.date})</span> : null}</p>
                <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center text-sm text-primary underline">{i.sourceTitle || t.openSource}</a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{checked(data.community.fetchedAt)}{data.community.stale ? ` ${t.stale}` : ""}</p>
        </div>
      ) : null}
    </section>
  );
}
