"use client";

/** CPA directory with service and city filters (in the browser; data is the public cached list). */
import Link from "next/link";
import { useState } from "react";
import type { Messages } from "@/i18n/dictionaries";
import { formatPeso } from "@/lib/format";
import { filterDirectory, SERVICES, type DirectoryEntry } from "@/lib/marketplace/rules";

const field = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base";

export function Directory({ list, locale, t }: { list: DirectoryEntry[]; locale: string; t: Messages["market"] }) {
  const [service, setService] = useState("");
  const [city, setCity] = useState("");
  const shown = filterDirectory(list, { service, city });
  const cities = [...new Set(list.flatMap((e) => e.cities))].sort();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="font-semibold">{t.filterService}</span>
          <select value={service} onChange={(e) => setService(e.target.value)} className={field}><option value="">{t.any}</option>{SERVICES.map((s) => <option key={s} value={s}>{t.services[s]}</option>)}</select>
        </label>
        <label className="space-y-1 text-sm"><span className="font-semibold">{t.filterCity}</span>
          <select value={city} onChange={(e) => setCity(e.target.value)} className={field}><option value="">{t.any}</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
      </div>
      {shown.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-muted-foreground">{t.empty}</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((e) => (
            <li key={e.user_id} className="space-y-1 rounded-lg border bg-card p-4">
              <Link href={`/${locale}/cpas/${e.user_id}`} className="text-lg font-bold text-primary underline-offset-2 hover:underline">{e.display_name}</Link>
              <p className="text-sm text-muted-foreground">{t.profession[e.profession]}{e.firm_name ? ` · ${e.firm_name}` : ""}</p>
              <p className="text-sm">{e.rating_count ? t.rating.replace("{avg}", String(e.rating_avg)).replace("{n}", String(e.rating_count)) : t.noRating}</p>
              <p className="text-sm">{e.services.map((s) => t.services[s]).join(", ")}</p>
              <p className="text-sm text-muted-foreground">{[e.cities.join(", "), e.online_only ? t.online : null].filter(Boolean).join(" · ")}</p>
              {e.starting_fee_php != null ? <p className="text-sm font-semibold">{t.startingAt.replace("{fee}", formatPeso(e.starting_fee_php))}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
