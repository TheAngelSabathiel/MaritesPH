/**
 * Situation landing pages: "How to get [document] [situation]".
 * Each maps to a planner preset. Pages are generated for every published guide.
 */
import type { PlannerInput } from "@/lib/engines/planner";

export const SITUATIONS = {
  "for-8-to-5-workers": { schedule: { preset: "office_8to5" }, leaveDays: 0 },
  "for-night-shift-workers": { schedule: { preset: "night_shift" }, leaveDays: 0 },
  "on-weekends": { schedule: { preset: "weekends_only" }, leaveDays: 0 },
} as const satisfies Record<string, Pick<PlannerInput, "schedule" | "leaveDays">>;

export type SituationSlug = keyof typeof SITUATIONS;

export function isSituation(value: string): value is SituationSlug {
  return value in SITUATIONS;
}

/** The generic plan used on a situation page: no documents yet, no location, no rush, no budget. */
export function situationInput(documentId: string, situation: SituationSlug): PlannerInput {
  const s = SITUATIONS[situation];
  return {
    goal: { kind: "document", documentId },
    have: [],
    origin: null,
    schedule: s.schedule,
    leaveDays: s.leaveDays,
    urgency: "no_rush",
    budget: null,
    transport: "commute",
  };
}
