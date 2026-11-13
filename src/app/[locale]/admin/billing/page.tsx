import { Suspense } from "react";
import { grantComp, updatePlan } from "@/lib/admin/billing-actions";
import { requireAdmin, type Row } from "@/lib/admin/data";
import { formatPeso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AdminLoading } from "@/components/admin/loading";

type Props = PageProps<"/[locale]/admin/billing">;
const field = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base";

export default function AdminBillingPage(props: Props) {
  return <Suspense fallback={<AdminLoading />}><Billing {...props} /></Suspense>;
}

async function Billing({ params }: Props) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const [plans, payments] = await Promise.all([
    supabase.from("subscription_plans").select("*").order("rank"),
    supabase.from("payments").select("id, user_id, plan_key, months, amount_php, provider, status, note, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Plans</h1>
        <p className="text-sm text-muted-foreground">Prices are per month in PHP; checkout charges price × months. A plan needs a price before it can be active. Changing a price affects new checkouts only.</p>
        {((plans.data ?? []) as Row[]).map((p) => (
          <form key={String(p.key)} action={updatePlan} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3 sm:items-end">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="key" value={String(p.key)} />
            <p className="font-bold sm:col-span-3">{String(p.name)}</p>
            <label className="space-y-1 text-sm"><span className="font-semibold">Monthly price (PHP)</span><input name="price" inputMode="decimal" defaultValue={p.monthly_price_php == null ? "" : String(p.monthly_price_php)} className={field} /></label>
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="active" defaultChecked={Boolean(p.active)} className="size-5" />Active (shown on Plans)</label>
            <Button type="submit" size="sm">Save</Button>
          </form>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Grant complimentary access</h2>
        <p className="text-sm text-muted-foreground">For testers, partners, or support cases. The user finds their account ID on their Billing page. Recorded as a ₱0 manual payment with your note.</p>
        <form action={grantComp} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <label className="space-y-1 text-sm sm:col-span-2"><span className="font-semibold">Account ID</span><input name="userId" required className={field} /></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">Plan</span><select name="plan" className={field}><option value="freelancer">Freelancer</option><option value="negosyo">Negosyo</option></select></label>
          <label className="space-y-1 text-sm"><span className="font-semibold">Months</span><select name="months" className={field}>{[1, 3, 6, 12].map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className="space-y-1 text-sm sm:col-span-2"><span className="font-semibold">Reason (required)</span><input name="note" required minLength={3} maxLength={300} className={field} /></label>
          <Button type="submit" className="sm:w-auto">Grant</Button>
        </form>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Recent payments</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted"><tr><th className="p-2">When</th><th className="p-2">Plan</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Note</th></tr></thead>
            <tbody>
              {((payments.data ?? []) as Row[]).map((p) => (
                <tr key={String(p.id)} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{String(p.created_at).slice(0, 16).replace("T", " ")}</td>
                  <td className="p-2">{String(p.plan_key)} × {String(p.months)}</td>
                  <td className="p-2">{formatPeso(Number(p.amount_php))}</td>
                  <td className={`p-2 font-semibold ${p.status === "review" ? "text-caution" : ""}`}>{String(p.status)} ({String(p.provider)})</td>
                  <td className="p-2">{p.note ? String(p.note) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
