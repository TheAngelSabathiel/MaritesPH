/** Builds the wizard's choices (documents, purposes, cities) from the published catalog. */
import { citySlug } from "@/lib/content/offices";
import { humanizeKey } from "@/lib/content/requirements";
import type { Catalog } from "@/lib/engines/types";
import type { WizardData } from "@/components/planner/wizard";

export function wizardData(catalog: Catalog, purposeLabels: Record<string, string>): WizardData {
  const purposes = [...new Set(catalog.documents.flatMap((d) => d.purposes))]
    .map((key) => ({ key, label: purposeLabels[key] ?? humanizeKey(key) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // City centre = average of its offices' coordinates (good enough for distance ranking).
  const byCity = new Map<string, { name: string; lat: number[]; lng: number[] }>();
  for (const o of catalog.offices) {
    if (!o.city || o.lat == null || o.lng == null) continue;
    const key = citySlug(o.city);
    const entry = byCity.get(key) ?? { name: o.city, lat: [], lng: [] };
    entry.lat.push(o.lat);
    entry.lng.push(o.lng);
    byCity.set(key, entry);
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const cities = [...byCity.entries()]
    .map(([slug, c]) => ({ slug, name: c.name, lat: avg(c.lat), lng: avg(c.lng) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    documents: catalog.documents.map(({ id, slug, name }) => ({ id, slug, name })),
    purposes,
    cities,
  };
}
