import { Suspense } from "react";
import { moderateTipAction } from "@/lib/admin/actions";
import { requireAdmin, type Row } from "@/lib/admin/data";
import { Button } from "@/components/ui/button";
import { AdminLoading } from "@/components/admin/loading";
import { StatusBadge } from "@/components/admin/status-badge";

type Props = PageProps<"/[locale]/admin/tips">;

const FLAG_LABELS: Record<string, string> = {
  mentions_fixer: "Mentions fixers",
  money_offer: "Mentions money",
  slot_offer: "Mentions slots / rush",
};

export default function TipsQueuePage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Queue {...props} />
    </Suspense>
  );
}

async function Queue({ params }: Props) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const [pending, recent, offices, docs] = await Promise.all([
    supabase.from("tips").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(200),
    supabase.from("tips").select("id, body, status, moderation_reason, reviewed_at").neq("status", "pending").order("reviewed_at", { ascending: false }).limit(20),
    supabase.from("offices").select("id, name"),
    supabase.from("documents").select("id, name"),
  ]);
  const officeName = new Map(((offices.data ?? []) as Row[]).map((o) => [String(o.id), String(o.name)]));
  const docName = new Map(((docs.data ?? []) as Row[]).map((d) => [String(d.id), String(d.name)]));
  const tips = (pending.data ?? []) as Row[];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Tips waiting for review ({tips.length})</h1>
        <p className="text-sm text-muted-foreground">
          Approve only first-hand experience. Reject anything offering slots, &ldquo;assistance&rdquo;, or contact details (those are
          refused automatically), personal data, or claims about requirements that belong in a verified record instead.
        </p>
        {tips.length === 0 ? <p className="rounded-md border border-dashed p-6 text-muted-foreground">No tips waiting.</p> : null}
        <ul className="space-y-3">
          {tips.map((tip) => (
            <li key={String(tip.id)} className="space-y-2 rounded-lg border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground">
                {tip.office_id ? officeName.get(String(tip.office_id)) : docName.get(String(tip.document_id))}
              </p>
              <p className="break-words">{String(tip.body)}</p>
              <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                {tip.wait_minutes != null ? <span>Waited {String(tip.wait_minutes)} min</span> : null}
                {tip.visited_on ? <span>Visited {String(tip.visited_on)}</span> : null}
              </p>
              {tip.extra_requirements_asked ? <p className="text-sm">Extra asked: {String(tip.extra_requirements_asked)}</p> : null}
              {(tip.auto_flags as string[]).length ? (
                <ul className="flex flex-wrap gap-1">
                  {(tip.auto_flags as string[]).map((f) => (
                    <li key={f} className="rounded-full bg-caution-soft px-2 py-0.5 text-xs font-semibold text-caution">{FLAG_LABELS[f] ?? f}</li>
                  ))}
                </ul>
              ) : null}
              <form action={moderateTipAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={String(tip.id)} />
                <label className="flex-1 space-y-1 text-sm">
                  <span className="font-semibold">Reason (optional)</span>
                  <input name="reason" maxLength={300} className="flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base" />
                </label>
                <Button type="submit" name="decision" value="approved" size="sm">Approve</Button>
                <Button type="submit" name="decision" value="rejected" size="sm" variant="outline">Reject</Button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Recently reviewed</h2>
        <ul className="divide-y rounded-lg border bg-card">
          {((recent.data ?? []) as Row[]).map((r) => (
            <li key={String(r.id)} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 break-words">{String(r.body).slice(0, 120)}{r.moderation_reason ? <span className="text-muted-foreground">, {String(r.moderation_reason)}</span> : null}</span>
              <StatusBadge status={String(r.status) === "approved" ? "published" : "archived"} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
