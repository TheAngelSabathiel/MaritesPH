"use client";

/**
 * "Open now / Closed now" badge. Computed in the browser from the visitor's
 * current time (Manila), because guide and office pages are cached and the
 * server can't know the time of each visit. Renders nothing until mounted.
 */
import { useEffect, useState } from "react";
import type { Day, Hours } from "@/lib/content/hours-core";
import { formatTime, openStatus } from "@/lib/content/offices";
import { cn } from "@/lib/utils";

export type OpenStatusStrings = {
  openNow: string;
  closesAt: string;
  closedNow: string;
  opensToday: string;
  opensOn: string;
  noHours: string;
  days: Record<Day, string>;
};

export function OpenStatusBadge({ hours, t, className }: { hours: Hours; t: OpenStatusStrings; className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Set after mount (not during render) and refresh every minute.
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (!now) return <span className={cn("inline-block min-h-6", className)} aria-hidden="true" />;

  const hasHours = Object.values(hours).some((d) => (d?.length ?? 0) > 0);
  if (!hasHours) return <span className={cn("text-sm text-muted-foreground", className)}>{t.noHours}</span>;

  const s = openStatus(hours, now);
  const detail = s.open
    ? t.closesAt.replace("{time}", formatTime(s.closesAt))
    : s.opensAt
      ? (s.opensAt.today ? t.opensToday : t.opensOn).replace("{day}", t.days[s.opensAt.day]).replace("{time}", formatTime(s.opensAt.time))
      : "";
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 text-sm", className)}>
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", s.open ? "bg-stamp-soft text-stamp" : "bg-muted text-foreground")}>
        {s.open ? t.openNow : t.closedNow}
      </span>
      {detail ? <span className="text-muted-foreground">{detail}</span> : null}
    </span>
  );
}
