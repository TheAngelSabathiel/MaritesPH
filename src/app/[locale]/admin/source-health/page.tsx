import { Suspense } from "react";
import { addSource, runMonitoringNow, updateSourceState } from "@/lib/admin/monitoring-actions";
import { requireAdmin, type Row } from "@/lib/admin/data";
import { PIPELINE_LIMITS } from "@/lib/monitoring/pipeline";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AdminLoading } from "@/components/admin/loading";

type Props = PageProps<"/[locale]/admin/source-health">;
const fmt = (v: unknown) => (v ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(String(v))) : "never");
const field = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base";

export default function SourceHealthPage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Health {...props} />
    </Suspense>
  );
}

async function Health({ params }: Props) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const { data } = await supabase.from("official_sources").select("*").order("active", { ascending: false }).order("name");
  const sources = (data ?? []) as Row[];
  const failing = sources.filter((s) => Number(s.failure_count) >= PIPELINE_LIMITS.alertAfterFailures);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Source health</h1>
        <form action={runMonitoringNow}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" size="sm">Run monitoring now</Button>
        </form>
      </div>
      {failing.length ? (
        <Alert tone="caution">
          {failing.length} source(s) failed {PIPELINE_LIMITS.alertAfterFailures}+ times in a row. The site layout or address may have changed: open the source, fix the URL or link pattern, or pause it.
        </Alert>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Sources are crawled on schedule (Vercel Cron) only when active. A source can be activated only after you check its URL, the site&apos;s terms, and robots.txt. The crawler identifies itself, respects robots.txt, waits between requests, and never logs in. Facebook pages are not crawled.
      </p>
      <ul className="space-y-3">
        {sources.map((s) => (
          <li key={String(s.id)} className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{String(s.name)}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.active ? "bg-stamp-soft text-stamp" : "bg-muted"}`}>{s.active ? "Active" : "Inactive"}</span>
            </div>
            <a href={String(s.url)} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-primary underline">{String(s.url)}</a>
            <p className="text-sm text-muted-foreground">
              {String(s.source_type)}, parser {String(s.parser_key)}, topic {String(s.topic)}, every {String(s.crawl_frequency_hours)} h. Last crawl {fmt(s.last_crawled_at)}; last success {fmt(s.last_success_at)}.
            </p>
            {Number(s.failure_count) > 0 ? <p className="text-sm font-semibold text-caution">{String(s.failure_count)} failure(s): {String(s.last_error ?? "")}</p> : null}
            {s.to_verify_note ? <p className="rounded-md bg-caution-soft px-3 py-2 text-sm">{String(s.to_verify_note)}</p> : null}
            <form action={updateSourceState} className="flex flex-wrap gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={String(s.id)} />
              {!s.active ? <Button type="submit" size="sm" name="action" value="verify_activate">I checked it: activate</Button> : <Button type="submit" size="sm" variant="outline" name="action" value="pause">Pause</Button>}
              <Button type="submit" size="sm" variant="ghost" name="action" value="delete" className="text-destructive">Remove</Button>
            </form>
          </li>
        ))}
      </ul>
      <details className="rounded-lg border bg-card">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">Add a source</summary>
        <form action={addSource} className="grid gap-3 border-t p-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <label className="space-y-1 text-sm sm:col-span-2"><span className="font-semibold">Name</span><input name="name" required className={field} /></label>
          <label className="space-y-1 text-sm sm:col-span-2"><span className="font-semibold">URL (https, official site)</span><input name="url" type="url" required className={field} /></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">Type</span><select name="source_type" className={field}><option value="html_list">HTML list</option><option value="rss">RSS / Atom feed</option><option value="pdf_list">PDF list</option><option value="manual">Manual</option></select></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">Parser</span><select name="parser_key" className={field}><option value="auto">Auto</option><option value="rss">Feed</option><option value="html_links">HTML links</option><option value="pdf_links">PDF links</option><option value="manual">Manual</option></select></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">Topic</span><select name="topic" className={field}><option value="ids">IDs</option><option value="tax">Tax</option><option value="business">Business</option><option value="general">General</option></select></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">Check every (hours)</span><input name="crawl_frequency_hours" type="number" min={6} max={720} defaultValue={24} className={field} /></label>
          <label className="space-y-1 text-sm sm:col-span-2"><span className="font-semibold">Link pattern (optional regular expression)</span><input name="link_pattern" placeholder="e.g. memorandum|circular" className={field} /></label>
          <Button type="submit" className="sm:col-span-2 sm:w-auto">Add (inactive until verified)</Button>
        </form>
      </details>
    </div>
  );
}
