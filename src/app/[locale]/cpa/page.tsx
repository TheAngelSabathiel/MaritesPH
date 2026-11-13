/**
 * CPA review page (role 'cpa'). Lists verified tax rules/deadlines awaiting CPA
 * review and Bantay Batas proposals for tax items. Admins can view it, but the
 * database refuses their approvals: only a licensed CPA can review tax rules.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@/i18n/config";
import { cpaApproveProposal, cpaReview } from "@/lib/admin/cpa-actions";
import type { Row } from "@/lib/admin/data";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AdminMessages } from "@/components/admin/messages";

export const metadata: Metadata = { title: "CPA review", robots: { index: false, follow: false } };

export default function CpaPage(props: PageProps<"/[locale]/cpa">) {
  return (
    <div className="space-y-5" lang="en">
      <Suspense fallback={null}><AdminMessages /></Suspense>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Review params={props.params} />
      </Suspense>
    </div>
  );
}

async function Review({ params }: { params: PageProps<"/[locale]/cpa">["params"] }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getCurrentUserClaims();
  if (!user) redirect(`/${locale}/login`);
  const supabase = await createSupabaseServerClient();
  const { data: me } = supabase ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  if (!supabase || (me?.role !== "cpa" && me?.role !== "admin")) notFound();
  const isCpa = me?.role === "cpa";

  const [rules, deadlines, proposals] = await Promise.all([
    supabase.from("tax_rules").select("*").in("status", ["verified", "published"]).eq("cpa_reviewed", false).order("rule_key"),
    supabase.from("tax_deadlines").select("*").in("status", ["verified", "published"]).eq("cpa_reviewed", false).order("form_code"),
    supabase.from("change_proposals").select("*").eq("status", "needs_cpa").in("target_type", ["tax_rule", "tax_deadline"]),
  ]);
  const items = [
    ...((rules.data ?? []) as Row[]).map((r) => ({ table: "tax_rules", id: String(r.id), title: String(r.rule_key), body: String(r.description), detail: r.parameters, from: String(r.effective_from), source: r.source_url })),
    ...((deadlines.data ?? []) as Row[]).map((r) => ({ table: "tax_deadlines", id: String(r.id), title: `${String(r.form_code)} (${String(r.frequency)})`, body: String(r.description ?? ""), detail: r.due_rule, from: String(r.effective_from), source: r.source_url })),
  ];

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">CPA review</h1>
      <p className="text-sm text-muted-foreground">
        Tax rules and deadlines can be published only after a licensed CPA reviews them. Check each against its official source (law, revenue regulation, or memorandum circular), including the effective dates.
        {isCpa ? "" : " You're signed in as an admin: you can see this queue, but only a CPA account can approve."}
      </p>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Awaiting review ({items.length})</h2>
        {items.length === 0 ? <p className="rounded-md border border-dashed p-6 text-muted-foreground">Nothing waiting.</p> : null}
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id} className="space-y-2 rounded-lg border bg-card p-4">
              <p className="font-bold">{i.title}</p>
              <p className="text-sm">{i.body}</p>
              <p className="text-sm text-muted-foreground">Effective from {i.from}</p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(i.detail, null, 2)}</pre>
              {i.source ? <a href={String(i.source)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all text-sm font-semibold text-primary underline">Official source</a> : <p className="text-sm font-semibold text-caution">No source</p>}
              {isCpa ? (
                <form action={cpaReview}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="table" value={i.table} />
                  <Button type="submit" size="sm">I reviewed this as a CPA</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Tax changes from Bantay Batas ({(proposals.data ?? []).length})</h2>
        <ul className="space-y-3">
          {((proposals.data ?? []) as Row[]).map((p) => (
            <li key={String(p.id)} className="space-y-2 rounded-lg border bg-card p-4">
              <p className="text-sm">{String(p.ai_rationale ?? "")}</p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify((p.proposed_change as { fields: unknown }).fields, null, 2)}</pre>
              {(p.source_urls as string[]).map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-primary underline">{u}</a>)}
              {isCpa ? (
                <form action={cpaApproveProposal}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={String(p.id)} />
                  <Button type="submit" size="sm">Approve and apply as CPA</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
