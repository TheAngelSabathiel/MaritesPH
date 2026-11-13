"use client";

/**
 * Office finder: filter by text, agency, city, document, weekend hours, and
 * walk-ins; optionally sort by distance (location never leaves the phone) and
 * show a map (Leaflet loads only when asked). Filtering runs in the browser
 * over the published office list, so it is instant even on slow connections.
 * Initial filters can come from the URL, e.g. /offices?document=passport.
 */
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useId, useMemo, useState } from "react";
import type { Messages } from "@/i18n/dictionaries";
import {
  agencySlug,
  citySlug,
  filterOffices,
  officePath,
  sortByDistance,
  type OfficeFilters,
  type PublicOffice,
} from "@/lib/content/offices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OfficeCard } from "./office-card";

type T = Messages["offices"];

const OfficeMap = dynamic(() => import("./office-map").then((m) => m.OfficeMap), { ssr: false });

const selectClass = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base";

export function OfficeFinder(props: { offices: PublicOffice[]; locale: string; t: T }) {
  return (
    <Suspense fallback={<Finder {...props} initial={{}} />}>
      <FinderFromUrl {...props} />
    </Suspense>
  );
}

function FinderFromUrl(props: { offices: PublicOffice[]; locale: string; t: T }) {
  const params = useSearchParams();
  const initial: OfficeFilters = {
    agency: params.get("agency") ?? undefined,
    city: params.get("city") ?? undefined,
    document: params.get("document") ?? undefined,
    weekend: params.get("weekend") === "1",
    walkIn: params.get("walkin") === "1",
  };
  return <Finder {...props} initial={initial} key={params.toString()} />;
}

function options(entries: [string, string][]) {
  return [...new Map(entries)].sort((a, b) => a[1].localeCompare(b[1]));
}

function Finder({ offices, locale, t, initial }: { offices: PublicOffice[]; locale: string; t: T; initial: OfficeFilters }) {
  const id = useId();
  const [filters, setFilters] = useState<OfficeFilters>(initial);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "working" | "error">("idle");
  const [showMap, setShowMap] = useState(false);

  const agencies = useMemo(() => options(offices.map((o) => [agencySlug(o.agency), o.agency.acronym ?? o.agency.name])), [offices]);
  const cities = useMemo(() => options(offices.filter((o) => o.city).map((o) => [citySlug(o.city), o.city!])), [offices]);
  const documents = useMemo(() => options(offices.flatMap((o) => o.documents.map((d) => [d.slug, d.name] as [string, string]))), [offices]);

  const results = useMemo(() => {
    const filtered = filterOffices(offices, filters);
    return origin ? sortByDistance(filtered, origin) : filtered.map((o) => ({ ...o, distanceKm: null as number | null }));
  }, [offices, filters, origin]);

  const set = (patch: Partial<OfficeFilters>) => setFilters((f) => ({ ...f, ...patch }));

  function locate() {
    if (!navigator.geolocation) return setGeoState("error");
    setGeoState("working");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("idle");
      },
      () => setGeoState("error"),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  }

  const points = results
    .filter((o) => o.lat != null && o.lng != null)
    .map((o) => ({ id: o.id, name: o.name, lat: o.lat!, lng: o.lng!, href: officePath(locale, o) }));

  return (
    <div className="space-y-5">
      <form role="search" className="space-y-4 rounded-lg border bg-card p-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor={`${id}-q`}>{t.searchLabel}</Label>
          <Input id={`${id}-q`} type="search" value={filters.query ?? ""} placeholder={t.searchPlaceholder} onChange={(e) => set({ query: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectFilter id={`${id}-doc`} label={t.documentLabel} any={t.any} value={filters.document} options={documents} onChange={(v) => set({ document: v })} />
          <SelectFilter id={`${id}-agency`} label={t.agencyLabel} any={t.any} value={filters.agency} options={agencies} onChange={(v) => set({ agency: v })} />
          <SelectFilter id={`${id}-city`} label={t.cityLabel} any={t.any} value={filters.city} options={cities} onChange={(v) => set({ city: v })} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <Toggle id={`${id}-weekend`} label={t.weekendLabel} checked={Boolean(filters.weekend)} onChange={(v) => set({ weekend: v })} />
          <Toggle id={`${id}-walkin`} label={t.walkInLabel} checked={Boolean(filters.walkIn)} onChange={(v) => set({ walkIn: v })} />
        </div>
        <div className="space-y-1">
          <Button type="button" variant="outline" onClick={locate} disabled={geoState === "working"} className="w-full sm:w-auto">
            {geoState === "working" ? t.nearMeWorking : t.nearMe}
          </Button>
          {geoState === "error" ? <p className="text-sm text-caution">{t.nearMeError}</p> : <p className="text-sm text-muted-foreground">{t.nearMeNote}</p>}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold" aria-live="polite">
          {t.results.replace("{count}", String(results.length))}
        </p>
        {points.length > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowMap((s) => !s)} aria-expanded={showMap}>
            {showMap ? t.hideMap : t.showMap}
          </Button>
        ) : null}
      </div>

      {showMap ? <OfficeMap points={points} loadingLabel={t.mapLoading} note={t.mapNote} /> : null}

      {results.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-muted-foreground">{t.noMatches}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {results.map((o) => (
            <li key={o.id}>
              <OfficeCard
                office={o}
                locale={locale}
                t={t}
                distanceText={o.distanceKm != null ? t.kmAway.replace("{km}", o.distanceKm < 10 ? o.distanceKm.toFixed(1) : String(Math.round(o.distanceKm))) : null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SelectFilter({ id, label, any, value, options, onChange }: { id: string; label: string; any: string; value?: string; options: [string, string][]; onChange: (v: string | undefined) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} className={selectClass}>
        <option value="">{any}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 shrink-0" />
      <span>{label}</span>
    </label>
  );
}
