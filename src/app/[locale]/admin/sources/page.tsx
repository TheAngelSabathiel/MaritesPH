import { Suspense } from "react";
import { isLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/admin/data";
import { groupSources, type SourceRow } from "@/lib/admin/sources";
import { formatPhDate } from "@/lib/content/freshness";
import { AdminLoading } from "@/components/admin/loading";

type Props = PageProps<"/[locale]/admin/sources">;

export default function SourcesPage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Sources {...props} />
    </Suspense>
  );
}

async function Sources({ params }: Props) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const { data } = await supabase.from("content_index").select("source_url, status, last_verified_at").neq("status", "archived").limit(5000);
  const { groups, missing } = groupSources((data ?? []) as SourceRow[]);
  const loc = isLocale(locale) ? locale : "en";

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Sources</h1>
      <p className="text-sm text-muted-foreground">
        Every official website our content relies on. If a site changes or goes down, this shows how many records to re-check.
        The automated source registry for law and issuance monitoring (Bantay Batas) comes in Phase 6.
      </p>
      {missing > 0 ? (
        <p className="rounded-md bg-caution-soft px-3 py-2 text-sm font-semibold">{missing} records have no source URL.</p>
      ) : null}
      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.host} className="rounded-lg border bg-card">
            <details>
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 p-4">
                <span className="break-all font-semibold">{g.host}</span>
                <span className="text-sm text-muted-foreground">
                  {g.records} records
                  {g.unverified ? `, ${g.unverified} never verified` : ""}
                  {g.oldestVerifiedAt ? `, oldest check ${formatPhDate(g.oldestVerifiedAt, loc)}` : ""}
                </span>
              </summary>
              <ul className="divide-y border-t">
                {g.urls.map((u) => (
                  <li key={u.url} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:justify-between">
                    <a href={u.url} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">
                      {u.url}
                    </a>
                    <span className="shrink-0 text-muted-foreground">{u.records} records</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
