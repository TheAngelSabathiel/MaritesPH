/**
 * LGU process data shapes (lgu_processes JSON columns) and the permit renewal
 * planner. Values come from verified, published lgu_processes rows only.
 */
import { z } from "zod";

export const lguStepsSchema = z.array(z.object({ title: z.string().min(1).max(200), body: z.string().max(1000).optional() })).max(30);
export const lguRequirementsSchema = z.array(z.object({ text: z.string().min(1).max(300), note: z.string().max(300).optional() })).max(40);
export const lguFeesSchema = z.array(z.object({ label: z.string().min(1).max(200), amount: z.number().min(0).nullable(), note: z.string().max(300).optional() })).max(30);
export const lguDeadlinesSchema = z.array(z.object({ label: z.string().min(1).max(200), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) })).max(10);

export type LguProcess = {
  id: string;
  city: string;
  process_type: string;
  title: string;
  steps: z.infer<typeof lguStepsSchema>;
  requirements: z.infer<typeof lguRequirementsSchema>;
  fees: z.infer<typeof lguFeesSchema>;
  deadlines: z.infer<typeof lguDeadlinesSchema>;
  source_url: string | null;
  last_verified_at: string | null;
};

export type RenewalPlan = {
  year: number;
  deadlines: { label: string; date: string; daysLeft: number }[];
  renewedAlready: boolean;
  nextDeadline: { label: string; date: string; daysLeft: number } | null;
};

/** Upcoming renewal deadlines for a business: this year's if still ahead (or not yet renewed), else next year's. */
export function renewalPlan(p: Pick<LguProcess, "deadlines">, renewedFor: number | null, today: string): RenewalPlan {
  const thisYear = Number(today.slice(0, 4));
  const at = (y: number) =>
    p.deadlines.map((d) => {
      const date = `${y}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
      return { label: d.label, date, daysLeft: Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000) };
    });
  const renewedAlready = renewedFor != null && renewedFor >= thisYear;
  const year = renewedAlready || at(thisYear).every((d) => d.daysLeft < 0) ? thisYear + 1 : thisYear;
  const deadlines = at(year).sort((a, b) => a.date.localeCompare(b.date));
  return { year, deadlines, renewedAlready, nextDeadline: deadlines.find((d) => d.daysLeft >= 0) ?? null };
}
