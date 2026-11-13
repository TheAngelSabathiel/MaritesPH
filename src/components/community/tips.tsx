/** Approved tips for an office ("Chika sa Pila" label) and the median reported wait. */
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { formatPhDate } from "@/lib/content/freshness";

export type PublicTip = { id: string; body: string; wait_minutes: number | null; extra_requirements_asked: string | null; visited_on: string | null; created_at: string };

export function TipsList({ tips, median, locale, t }: { tips: PublicTip[]; median: { minutes: number; count: number } | null; locale: Locale; t: Messages["tips"] }) {
  return (
    <div className="space-y-3">
      <p className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{t.heading}</p>
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      {median ? <p className="font-semibold">{t.medianWait.replace("{minutes}", String(median.minutes)).replace("{count}", String(median.count))}</p> : null}
      {tips.length === 0 ? (
        <p className="text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="space-y-2">
          {tips.map((tip) => (
            <li key={tip.id} className="rounded-lg border-2 border-dashed border-folder bg-card p-3">
              <p className="break-words">{tip.body}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                {tip.wait_minutes != null ? <span>{t.waited.replace("{minutes}", String(tip.wait_minutes))}</span> : null}
                <span>{t.visited.replace("{date}", formatPhDate(tip.visited_on ?? tip.created_at, locale))}</span>
              </p>
              {tip.extra_requirements_asked ? <p className="text-sm">{t.extra.replace("{text}", tip.extra_requirements_asked)}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
