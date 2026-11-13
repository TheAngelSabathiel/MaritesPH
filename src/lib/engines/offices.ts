/**
 * Office ranking: which office should someone go to for a document?
 * Not just the nearest: it weighs distance, whether the office is open during
 * the person's free time, walk-in policy, data freshness, and (from Phase 5)
 * recent wait times reported in tips. Every ranking carries its reasons.
 *
 * All weights are named constants below and documented in the README.
 */
import { DAYS, type Day } from "@/lib/content/hours";
import { getFreshness } from "@/lib/content/freshness";
import { distanceKm, type PublicOffice } from "@/lib/content/offices";

export type FreeWindow = { day: Day; start: string; end: string };
export type Transport = "walk" | "commute" | "drive";

export const RANKING_WEIGHTS = {
  base: 100,
  /** Points lost per km, capped. */
  perKm: 2,
  maxDistancePenalty: 40,
  /** Open during the person's free time (no leave needed). */
  openInFreeTime: 30,
  /** Only open when the person is working (leave needed). */
  notOpenInFreeTime: -10,
  walkIn: 10,
  appointmentNeeded: -5,
  weekendHours: 5,
  staleData: -15,
  /** Points lost per minute of typical wait, capped (wait data arrives in Phase 5). */
  perWaitMinute: 1 / 6,
  maxWaitPenalty: 20,
  /** Shortest useful overlap between free time and opening hours. */
  minOverlapMinutes: 30,
  /** "Near" means within this many km. */
  nearKm: 5,
} as const;

/** Rough door-to-door speeds for Philippine cities (km/h). Assumption, see README. */
export const TRAVEL_SPEED_KMH: Record<Transport, number> = { walk: 4, commute: 15, drive: 20 };

export type OfficeReason =
  | { code: "near"; km: number }
  | { code: "far"; km: number }
  | { code: "open_in_free_time"; day: Day; start: string; end: string }
  | { code: "not_open_in_free_time" }
  | { code: "weekend_hours" }
  | { code: "walk_in" }
  | { code: "appointment_needed" }
  | { code: "walk_in_unknown" }
  | { code: "stale"; days: number }
  | { code: "short_wait"; minutes: number }
  | { code: "long_wait"; minutes: number };

export type RankedOffice = {
  office: PublicOffice;
  score: number;
  distanceKm: number | null;
  travelMinutes: number | null;
  /** Times the office is open while the person is free, Monday first. */
  freeTimeSlots: FreeWindow[];
  reasons: OfficeReason[];
};

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Overlaps between free windows and opening hours, at least minOverlapMinutes long. */
export function freeTimeSlots(office: Pick<PublicOffice, "hours">, free: FreeWindow[]): FreeWindow[] {
  const slots: FreeWindow[] = [];
  for (const day of DAYS) {
    for (const w of free.filter((f) => f.day === day)) {
      for (const [open, close] of office.hours[day] ?? []) {
        const start = Math.max(minutes(open), minutes(w.start));
        const end = Math.min(minutes(close), minutes(w.end));
        if (end - start >= RANKING_WEIGHTS.minOverlapMinutes) slots.push({ day, start: hhmm(start), end: hhmm(end) });
      }
    }
  }
  return slots;
}

export function rankOffices(input: {
  offices: PublicOffice[];
  documentId: string;
  origin?: { lat: number; lng: number } | null;
  freeWindows: FreeWindow[];
  transport: Transport;
  staleDays: number;
  now: Date;
  waitMinutes?: Record<string, number>;
}): RankedOffice[] {
  const W = RANKING_WEIGHTS;
  return input.offices
    .filter((o) => o.documents.some((d) => d.id === input.documentId))
    .map((office) => {
      const reasons: OfficeReason[] = [];
      let score: number = W.base;

      let km: number | null = null;
      if (input.origin && office.lat != null && office.lng != null) {
        km = Math.round(distanceKm(input.origin, { lat: office.lat, lng: office.lng }) * 10) / 10;
        score -= Math.min(W.maxDistancePenalty, km * W.perKm);
        reasons.push(km <= W.nearKm ? { code: "near", km } : { code: "far", km });
      }

      const slots = freeTimeSlots(office, input.freeWindows);
      if (slots.length) {
        score += W.openInFreeTime;
        reasons.push({ code: "open_in_free_time", ...slots[0] });
      } else {
        score += W.notOpenInFreeTime;
        reasons.push({ code: "not_open_in_free_time" });
      }
      if ((office.hours.sat?.length ?? 0) + (office.hours.sun?.length ?? 0) > 0) {
        score += W.weekendHours;
        reasons.push({ code: "weekend_hours" });
      }

      if (office.acceptsWalkIn === true) {
        score += W.walkIn;
        reasons.push({ code: "walk_in" });
      } else if (office.acceptsWalkIn === false) {
        score += W.appointmentNeeded;
        reasons.push({ code: "appointment_needed" });
      } else {
        reasons.push({ code: "walk_in_unknown" });
      }

      const fresh = getFreshness(office.lastVerifiedAt, input.now, input.staleDays);
      if (fresh.state === "stale") {
        score += W.staleData;
        reasons.push({ code: "stale", days: fresh.ageDays });
      }

      const wait = input.waitMinutes?.[office.id];
      if (wait != null) {
        score -= Math.min(W.maxWaitPenalty, wait * W.perWaitMinute);
        reasons.push(wait <= 30 ? { code: "short_wait", minutes: wait } : { code: "long_wait", minutes: wait });
      }

      return {
        office,
        score: Math.round(score * 10) / 10,
        distanceKm: km,
        travelMinutes: km == null ? null : Math.round((km / TRAVEL_SPEED_KMH[input.transport]) * 60),
        freeTimeSlots: slots,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.office.name.localeCompare(b.office.name));
}
