import { Suspense } from "react";
import { resolveFlag } from "@/lib/admin/actions";
import { requireAdmin, type Row } from "@/lib/admin/data";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AdminLoading } from "@/components/admin/loading";
import { IndexRows, typeLabel } from "@/components/admin/index-rows";
import { StatusBadge } from "@/components/admin/status-badge";

type Props = PageProps<"/[locale]/admin/flags">;

const REASONS: Record<string, string> = {
  outdated: "Outdated",
  incorrect: "Incorrect",
  fixer: "Fixer / paid slots",
  other: "Other",
};

export default function FlagsPage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Flags {...props} />
    </Suspense>
  );
}

async function Flags({ params }: Props) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const [open, recent] = await Promise.all([
    supabase.from("content_flags").select("*").eq("status", "open").order("created_at", { ascending: true }).limit(200),
    supabase.from("content_flags").select("*").neq("status", "open").order("resolved_at", { ascending: false }).limit(20),
  ]);
  const openFlags = (open.data ?? []) as Row[];
  const recentFlags = (recent.data ?? []) as Row[];

  // Attach labels/links from content_index.
  const ids = [...new Set(openFlags.map((f) => String(f.target_id)))];
  const { data: targets } = ids.length
    ? await supabase.from("content_index").select("*").in("id", ids)
    : { data: [] as Row[] };
  const byId = new Map(((targets ?? []) as Row[]).map((t) => [String(t.id), t]));
  const fmt = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

  const rows: Row[] = openFlags.map((f) => {
    const t = byId.get(String(f.target_id));
    return {
      ...f,
      flag_id: f.id,
      id: f.target_id,
      label: t?.label ?? "(record not visible)",
      parent_type: t?.parent_type,
      parent_id: t?.parent_id,
      status: "open",
    };
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Open flags ({rows.length})</h1>
        <p className="text-sm text-muted-foreground">
          Reports from users and automatic checks. Fix the record first, then resolve the flag with a short note. Fixer reports
          should lead to removing the content and reviewing the account.
        </p>
        <IndexRows
          rows={rows}
          locale={locale}
          empty="No open flags."
          detail={(r) => (
            <div className="space-y-1">
              <p>
                <span className="font-semibold">{REASONS[String(r.reason)] ?? String(r.reason)}</span>
                <span className="text-muted-foreground">
                  {" "}
                  from {String(r.source) === "system" ? "automatic check" : "a user"}, {fmt.format(new Date(String(r.created_at)))}
                </span>
              </p>
              {r.details ? <p className="break-words">{String(r.details)}</p> : null}
              {r.evidence_url ? (
                <a href={String(r.evidence_url)} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">
                  Evidence link
                </a>
              ) : null}
            </div>
          )}
          aside={(r) => (
            <form action={resolveFlag} className="space-y-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={String(r.flag_id)} />
              <Label htmlFor={`note-${String(r.flag_id)}`}>Resolution note</Label>
              <textarea
                id={`note-${String(r.flag_id)}`}
                name="note"
                rows={2}
                maxLength={1000}
                className="flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base"
                placeholder="What you changed, or why no change was needed"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" name="status" value="resolved" size="sm">
                  Resolve
                </Button>
                <Button type="submit" name="status" value="dismissed" size="sm" variant="outline">
                  Dismiss
                </Button>
              </div>
            </form>
          )}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Recently closed</h2>
        {recentFlags.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {recentFlags.map((f) => (
              <li key={String(f.id)} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 break-words">
                  {typeLabel(String(f.target_type))}: {REASONS[String(f.reason)] ?? String(f.reason)}
                  {f.resolution_note ? <span className="text-muted-foreground">, {String(f.resolution_note)}</span> : null}
                </span>
                <StatusBadge status={String(f.status)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
