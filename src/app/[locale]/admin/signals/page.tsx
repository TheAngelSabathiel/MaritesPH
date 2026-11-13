import { Suspense } from "react";
import { dismissSignal } from "@/lib/admin/monitoring-actions";
import { requireAdmin, type Row } from "@/lib/admin/data";
import { SIGNAL_RULES } from "@/lib/monitoring/signals";
import { Button } from "@/components/ui/button";
import { AdminLoading } from "@/components/admin/loading";

type Props = PageProps<"/[locale]/admin/signals">;
const LABELS: Record<string, string> = { long_queue: "Long queues", new_requirement: "Extra requirements reported", outage: "Outage", policy_confusion: "Policy confusion" };

export default function SignalsPage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Signals {...props} />
    </Suspense>
  );
}

async function Signals({ params }: Props) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const [{ data }, { data: offices }] = await Promise.all([
    supabase.from("community_signals").select("*").eq("status", "open").order("last_seen", { ascending: false }),
    supabase.from("offices").select("id, name"),
  ]);
  const officeName = new Map(((offices ?? []) as Row[]).map((o) => [String(o.id), String(o.name)]));
  const signals = (data ?? []) as Row[];
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-extrabold tracking-tight">Community signals ({signals.length})</h1>
      <p className="text-sm text-muted-foreground">
        Patterns in approved tips over the last {SIGNAL_RULES.windowDays} days ({SIGNAL_RULES.minLongWaits}+ waits of {SIGNAL_RULES.longWaitMinutes}+ min, or {SIGNAL_RULES.minExtraReports}+ reports of extra requirements). A hint to re-check the office or guide against official sources, never a content change.
      </p>
      {signals.length === 0 ? <p className="rounded-md border border-dashed p-6 text-muted-foreground">No open signals.</p> : null}
      <ul className="space-y-3">
        {signals.map((s) => (
          <li key={String(s.id)} className="space-y-2 rounded-lg border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground">{LABELS[String(s.signal_type)] ?? String(s.signal_type)} · {String(s.mention_count)} reports</p>
            <p className="font-bold">{s.office_id ? officeName.get(String(s.office_id)) : "Document"}</p>
            <p className="text-sm">{String(s.summary)}</p>
            <form action={dismissSignal}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={String(s.id)} />
              <Button type="submit" size="sm" variant="outline">Checked: dismiss</Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
