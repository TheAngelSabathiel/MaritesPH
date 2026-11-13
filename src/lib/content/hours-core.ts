/**
 * Office hours core (no Zod, safe for browser bundles): day names, the Hours
 * shape, and pure helpers. Validation lives in ./hours.ts (hoursSchema).
 *   { "mon": [["08:00","17:00"]], "sat": [["08:00","12:00"]], "sun": [] }
 * Missing day or empty array = closed. Up to 3 intervals per day.
 */
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** [open, close] in 24-hour "HH:MM", Philippine time. */
export type Interval = [string, string];
export type Hours = Partial<Record<Day, Interval[]>>;

/** True if the office is open on that day at all. */
export function isOpenOn(hours: Hours, day: Day): boolean {
  return (hours[day]?.length ?? 0) > 0;
}

export function hasWeekendHours(hours: Hours): boolean {
  return isOpenOn(hours, "sat") || isOpenOn(hours, "sun");
}

/**
 * Build Hours from flat form fields: `<day>_open`, `<day>_close`, and an
 * optional second interval `<day>_open2`, `<day>_close2`. Empty = closed.
 */
export function hoursFromFields(get: (name: string) => string | null): unknown {
  const out: Record<string, [string, string][]> = {};
  for (const day of DAYS) {
    const list: [string, string][] = [];
    for (const suffix of ["", "2"]) {
      const open = get(`${day}_open${suffix}`)?.trim() ?? "";
      const close = get(`${day}_close${suffix}`)?.trim() ?? "";
      if (open || close) list.push([open, close]);
    }
    out[day] = list;
  }
  return out;
}
