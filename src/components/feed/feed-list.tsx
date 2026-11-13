"use client";

/** "Ano'ng Bago?" list with topic filter chips (filtering happens in the browser). */
import Link from "next/link";
import { useState } from "react";
import type { Messages } from "@/i18n/dictionaries";
import type { FeedItem } from "@/lib/content/public";
import { cn } from "@/lib/utils";

const TOPICS = ["all", "ids", "tax", "business", "general"] as const;

export function FeedList({ items, locale, t }: { items: FeedItem[]; locale: string; t: Messages["feed"] }) {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("all");
  const shown = topic === "all" ? items : items.filter((i) => i.topic === topic);
  const fmt = new Intl.DateTimeFormat(locale === "fil" ? "fil-PH" : "en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
  return (
    <div className="space-y-4">
      <div role="group" aria-label={t.filterLabel} className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2">
          {TOPICS.map((k) => (
            <button key={k} type="button" aria-pressed={topic === k} onClick={() => setTopic(k)} className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold", topic === k ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
              {t.topics[k]}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-muted-foreground">{t.empty}</p> : null}
      <ol className="space-y-3">
        {shown.map((i) => (
          <li key={`${i.kind}-${i.id}`} className={cn("rounded-lg border bg-card p-4", i.kind === "change" && "border-l-4 border-l-stamp")}>
            <p className="text-xs font-semibold text-muted-foreground">
              {i.kind === "change" ? t.changeLabel : t.issuanceLabel} · {fmt.format(new Date(i.date))}
              {i.issuingBody ? ` · ${i.issuingBody}` : ""}
              {i.issuanceNumber ? ` · ${i.issuanceNumber}` : ""}
            </p>
            <p className="font-bold leading-snug">{i.title}</p>
            {i.summary ? <p className="text-sm">{i.summary}</p> : null}
            <div className="flex flex-wrap gap-x-4">
              {i.guideSlug ? <Link href={`/${locale}/ids/${i.guideSlug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{t.seeGuide}</Link> : null}
              {i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{t.officialSource}</a> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
