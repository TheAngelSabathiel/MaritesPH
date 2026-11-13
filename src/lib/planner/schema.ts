/** Validation for wizard input (shared by the Server Action and tests). */
import { z } from "zod";
import { DAYS } from "@/lib/content/hours";
import { SCHEDULE_PRESETS } from "@/lib/engines/planner";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const plannerInputSchema = z.object({
  goal: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("document"), documentId: z.guid() }),
    z.object({ kind: z.literal("purpose"), purpose: z.string().regex(/^[a-z0-9_]{1,60}$/) }),
  ]),
  have: z.array(z.guid()).max(100),
  origin: z.object({ lat: z.number().min(4).max(22), lng: z.number().min(116).max(127) }).nullable(),
  schedule: z.object({
    preset: z.enum(SCHEDULE_PRESETS),
    custom: z.object({ days: z.array(z.enum(DAYS)).max(7), start: time, end: time }).optional(),
  }),
  leaveDays: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  urgency: z.enum(["asap", "this_month", "no_rush"]),
  budget: z.number().min(0).max(1_000_000).nullable(),
  transport: z.enum(["walk", "commute", "drive"]),
});

export type PlannerFormInput = z.infer<typeof plannerInputSchema>;
