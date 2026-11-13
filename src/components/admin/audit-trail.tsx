import type { Row } from "@/lib/admin/data";

/** Recent status changes for a record and its children (from verification_events). */
export function AuditTrail({ events, labels }: { events: Row[]; labels: Record<string, string> }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>;
  const fmt = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
  return (
    <ol className="space-y-2 text-sm">
      {events.map((e) => (
        <li key={String(e.id)} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <time className="shrink-0 text-muted-foreground" dateTime={String(e.created_at)}>
            {fmt.format(new Date(String(e.created_at)))}
          </time>
          <span className="min-w-0 break-words">
            {labels[String(e.target_id)] ?? String(e.target_type)}: {e.from_status ? `${String(e.from_status)} → ` : "created as "}
            {String(e.to_status)}
            {e.actor ? "" : " (system or seed)"}
          </span>
        </li>
      ))}
    </ol>
  );
}
