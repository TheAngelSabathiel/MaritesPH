import { Suspense } from "react";
import { reverifyRecord } from "@/lib/admin/actions";
import { requireAdmin, type Row } from "@/lib/admin/data";
import { adminPath } from "@/lib/admin/paths";
import { resourceForTargetType } from "@/lib/admin/resources";
import { getFreshness } from "@/lib/content/freshness";
import { serverEnv } from "@/lib/env.server";
import { staleCutoffIso } from "@/lib/admin/time";
import { Button } from "@/components/ui/button";
import { AdminLoading } from "@/components/admin/loading";
import { IndexRows } from "@/components/admin/index-rows";

type Props = PageProps<"/[locale]/admin/stale">;

export default function StalePage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Stale {...props} />
    </Suspense>
  );
}

async function Stale({ params }: Props) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const staleDays = serverEnv().CONTENT_STALE_DAYS;
  const now = new Date();
  const cutoff = staleCutoffIso(staleDays, now);

  const { data } = await supabase
    .from("content_index")
    .select("*")
    .in("status", ["verified", "published"])
    .lt("last_verified_at", cutoff)
    .order("last_verified_at", { ascending: true })
    .limit(300);
  const rows = (data ?? []) as Row[];

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-extrabold tracking-tight">Stale content ({rows.length})</h1>
      <p className="text-sm text-muted-foreground">
        Verified or published records last checked more than {staleDays} days ago. Users see a &ldquo;may be outdated&rdquo;
        warning on these. Open the source, confirm nothing changed, then re-verify. If something changed, edit the record
        instead.
      </p>
      <IndexRows
        rows={rows}
        locale={locale}
        empty="Nothing is stale. Everything was checked recently."
        detail={(r) => {
          const f = getFreshness(r.last_verified_at as string | null, now, staleDays);
          return (
            <p className="font-semibold text-caution">
              Last verified {f.state === "unverified" ? "never" : `${f.ageDays} days ago`}
              {r.source_url ? (
                <>
                  {" "}
                  <a href={String(r.source_url)} target="_blank" rel="noopener noreferrer" className="font-normal text-primary underline">
                    Open source
                  </a>
                </>
              ) : null}
            </p>
          );
        }}
        aside={(r) => {
          const resource = resourceForTargetType(String(r.target_type));
          if (!resource) return null;
          return (
            <form action={reverifyRecord}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="resource" value={resource.slug} />
              <input type="hidden" name="id" value={String(r.id)} />
              <input type="hidden" name="return_to" value={adminPath(locale, "stale")} />
              <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                Still correct: re-verify today
              </Button>
            </form>
          );
        }}
      />
    </section>
  );
}
