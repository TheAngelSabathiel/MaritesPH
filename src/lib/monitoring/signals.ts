/**
 * Community signals from approved tips (deterministic, no AI): recurring long
 * queues and repeated "extra requirement" reports per office over 30 days.
 * Signals are for admins only: a hint to re-check, never a content change.
 */
export type TipForSignals = { office_id: string | null; wait_minutes: number | null; extra_requirements_asked: string | null; created_at: string };
export type Signal = { officeId: string; type: "long_queue" | "new_requirement"; summary: string; count: number };

export const SIGNAL_RULES = { windowDays: 30, longWaitMinutes: 120, minLongWaits: 3, minExtraReports: 2 } as const;

export function aggregateTipSignals(tips: TipForSignals[], now: Date): Signal[] {
  const since = now.getTime() - SIGNAL_RULES.windowDays * 86_400_000;
  const byOffice = new Map<string, TipForSignals[]>();
  for (const t of tips) {
    if (!t.office_id || Date.parse(t.created_at) < since) continue;
    byOffice.set(t.office_id, [...(byOffice.get(t.office_id) ?? []), t]);
  }
  const out: Signal[] = [];
  for (const [officeId, list] of byOffice) {
    const long = list.filter((t) => (t.wait_minutes ?? 0) >= SIGNAL_RULES.longWaitMinutes);
    if (long.length >= SIGNAL_RULES.minLongWaits) {
      out.push({ officeId, type: "long_queue", count: long.length, summary: `${long.length} recent reports of waits of ${SIGNAL_RULES.longWaitMinutes}+ minutes.` });
    }
    const extras = list.map((t) => t.extra_requirements_asked?.trim()).filter((x): x is string => Boolean(x));
    if (extras.length >= SIGNAL_RULES.minExtraReports) {
      const distinct = [...new Set(extras.map((e) => e.toLowerCase()))].slice(0, 3);
      out.push({ officeId, type: "new_requirement", count: extras.length, summary: `People report being asked for: ${distinct.join("; ")}`.slice(0, 500) });
    }
  }
  return out;
}
