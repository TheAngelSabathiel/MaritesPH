/**
 * Office hours validation (Zod; server and admin forms). The shape and pure
 * helpers live in ./hours-core.ts so browser bundles don't pull in Zod.
 */
import { z } from "zod";
import { DAYS, type Day, type Hours } from "./hours-core";

export * from "./hours-core";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

const interval = z
  .tuple([time, time])
  .refine(([open, close]) => open < close, "Closing time must be after opening time");

const dayIntervals = z
  .array(interval)
  .max(3)
  .refine((list) => {
    const sorted = [...list].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.every((cur, i) => i === 0 || sorted[i - 1][1] <= cur[0]);
  }, "Intervals in one day must not overlap");

export const hoursSchema = z
  .object(Object.fromEntries(DAYS.map((d) => [d, dayIntervals.optional()])) as Record<Day, z.ZodOptional<typeof dayIntervals>>)
  .strict();

// The inferred schema type must match the hand-written Hours type in hours-core.
type _Check = z.infer<typeof hoursSchema> extends Hours ? (Hours extends z.infer<typeof hoursSchema> ? true : never) : never;
export const _hoursTypeMatches: _Check = true;
