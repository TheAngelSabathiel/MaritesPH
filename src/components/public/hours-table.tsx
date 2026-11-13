import { DAYS, type Day, type Hours } from "@/lib/content/hours";
import { formatTime } from "@/lib/content/offices";

/** Weekly hours as a simple two-column list (fits 360px). */
export function HoursTable({ hours, closedLabel, days }: { hours: Hours; closedLabel: string; days: Record<Day, string> }) {
  return (
    <dl className="divide-y rounded-lg border bg-card">
      {DAYS.map((day) => {
        const intervals = hours[day] ?? [];
        return (
          <div key={day} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="font-semibold">{days[day]}</dt>
            <dd className="text-right">
              {intervals.length === 0 ? (
                <span className="text-muted-foreground">{closedLabel}</span>
              ) : (
                intervals.map(([open, close]) => (
                  <span key={open} className="block">
                    {formatTime(open)} – {formatTime(close)}
                  </span>
                ))
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
