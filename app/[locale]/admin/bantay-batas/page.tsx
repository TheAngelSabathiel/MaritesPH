import { Suspense } from "react";
import { approveProposal, rejectProposal, setIssuancePublished, setLinkStatus } from "@/lib/admin/monitoring-actions";
import { requireAdmin, type Row } from "@/lib/admin/data";
import { Button } from "@/components/ui/button";
import { AdminLoading } from "@/components/admin/loading";
import { IndexRows, typeLabel } from "@/components/admin/index-rows";

type Props = PageProps<"/[locale]/admin/bantay-batas">;
const show = (v: unknown) => (v == null ? "(empty)" : Array.isArray(v) ? v.join(", ") : String(v));

export default function BantayBatasPage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Queue {...props} />
    </Suspense>
  );
}

async function Queue({ params }: Props) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const [proposals, links, recent] = await Promise.all([
    supabase.from("change_proposals").select("*").in("status", ["open", "needs_cpa"]).order("created_at").limit(100),
    supabase.from("issuance_links").select("*").eq("link_status", "proposed").order("relevance_score", { ascending: false }).limit(100),
    supabase.from("issuances").select("id, title, url, issuing_body, issuance_number, date_issued, summary, extraction_status, classification_status, published, created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  const props = (proposals.data ?? []) as Row[];
  const issIds = [...new Set([...props.map((p) => p.issuance_id), ...((links.data ?? []) as Row[]).map((l) => l.issuance_id)].filter(Boolean).map(String))];
  const targetIds = [...new Set([...props, ...((links.data ?? []) as Row[])].map((r) => String(r.target_id)))];
  const [{ data: issData }, { data: idx }] = await Promise.all([
    issIds.length ? supabase.from("issuances").select("*").in("id", issIds) : Promise.resolve({ data: [] as Row[] }),
    targetIds.length ? supabase.from("content_index").select("*").in("id", targetIds) : Promise.resolve({ data: [] as Row[] }),
  ]);
  const iss = new Map(((issData ?? []) as Row[]).map((i) => [String(i.id), i]));
  const label = new Map(((idx ?? []) as Row[]).map((r) => [String(r.id), r]));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Bantay Batas: proposed changes ({props.length})</h1>
        <p className="text-sm text-muted-foreground">
          Drafted by AI from official issuances. Nothing changes until you approve. Open the issuance, check the exact wording, edit the values if needed, then approve or reject. Approving stamps the record as verified by you, publishes the issuance to &ldquo;Ano&apos;ng Bago?&rdquo;, and alerts people tracking the document.
        </p>
        {props.length === 0 ? <p className="rounded-md border border-dashed p-6 text-muted-foreground">No proposals waiting.</p> : null}
        <ul className="space-y-4">
          {props.map((p) => {
            const i = p.issuance_id ? iss.get(String(p.issuance_id)) : undefined;
            const t = label.get(String(p.target_id));
            const fields = (p.proposed_change as { fields: Record<string, { before: unknown; after: unknown }> }).fields;
            return (
              <li key={String(p.id)} className="space-y-3 rounded-lg border bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground">{typeLabel(String(p.target_type))}{p.status === "needs_cpa" ? " · needs CPA review" : ""}</p>
                <p className="font-bold">{t ? String(t.label) : String(p.target_id)}</p>
                {i ? (
                  <div className="rounded-md bg-muted/60 p-3 text-sm">
                    <p className="font-semibold">{[i.issuing_body, i.issuance_number, i.date_issued].filter(Boolean).map(String).join(", ")}</p>
                    <a href={String(i.url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all font-semibold text-primary underline">{String(i.title)}</a>
                    {i.summary ? <p>{String(i.summary)}</p> : null}
                    {i.extracted_text ? (
                      <details>
                        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">Extracted text</summary>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{String(i.extracted_text).slice(0, 8000)}</pre>
                      </details>
                    ) : null}
                  </div>
                ) : null}
                {p.ai_rationale ? <p className="text-sm"><span className="font-semibold">AI rationale: </span>{String(p.ai_rationale)}</p> : null}
                <form action={approveProposal} className="space-y-3">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={String(p.id)} />
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead><tr><th className="py-1 pr-3">Field</th><th className="py-1 pr-3">Now</th><th className="py-1">Proposed (edit if needed)</th></tr></thead>
                      <tbody>
                        {Object.entries(fields).map(([k, v]) => (
                          <tr key={k} className="border-t align-top">
                            <td className="py-2 pr-3 font-semibold">{k}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{show(v.before)}</td>
                            <td className="py-2"><input name={`f_${k}`} defaultValue={v.after == null ? "" : Array.isArray(v.after) ? v.after.join(", ") : String(v.after)} className="flex min-h-11 w-full min-w-40 rounded-md border border-input bg-card px-3 text-base" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <input name="note" maxLength={1000} placeholder="Review note (optional)" className="flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base" />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="submit" size="sm">Approve and apply</Button>
                    <Button type="submit" size="sm" variant="outline" formAction={rejectProposal}>Reject</Button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Possible legal context ({(links.data ?? []).length})</h2>
        <p className="text-sm text-muted-foreground">Issuances that may relate to a record without changing it. Confirm to keep the link; add it as a legal reference from the record page if it belongs in &ldquo;Bakit ganito?&rdquo;.</p>
        <IndexRows
          locale={locale}
          empty="Nothing to review."
          rows={((links.data ?? []) as Row[]).map((l) => {
            const t = label.get(String(l.target_id));
            return { ...l, link_id: l.id, id: l.target_id, label: t?.label ?? String(l.target_id), parent_type: t?.parent_type, parent_id: t?.parent_id, status: "open" };
          })}
          detail={(r) => {
            const i = iss.get(String(r.issuance_id));
            return (
              <p>
                {i ? <a href={String(i.url)} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">{String(i.title)}</a> : null}
                <span className="text-muted-foreground"> · relevance {String(r.relevance_score)}{r.reason ? `: ${String(r.reason)}` : ""}</span>
              </p>
            );
          }}
          aside={(r) => (
            <form action={setLinkStatus} className="flex gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={String(r.link_id)} />
              <Button type="submit" size="sm" name="status" value="confirmed">Confirm</Button>
              <Button type="submit" size="sm" variant="outline" name="status" value="rejected">Not related</Button>
            </form>
          )}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Recent issuances</h2>
        <ul className="divide-y rounded-lg border bg-card">
          {((recent.data ?? []) as Row[]).map((i) => (
            <li key={String(i.id)} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                <a href={String(i.url)} target="_blank" rel="noopener noreferrer" className="break-words font-semibold text-primary underline">{String(i.title)}</a>
                <span className="block text-xs text-muted-foreground">Text: {String(i.extraction_status)} · Classification: {String(i.classification_status)}</span>
              </span>
              <form action={setIssuancePublished}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={String(i.id)} />
                <input type="hidden" name="published" value={i.published ? "false" : "true"} />
                <Button type="submit" size="sm" variant="outline">{i.published ? "Hide from Ano'ng Bago?" : "Show in Ano'ng Bago?"}</Button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
