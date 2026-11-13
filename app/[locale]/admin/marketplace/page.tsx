import { Suspense } from "react";
import { setFeeRate, setFeeStatus, setListingStatus, setReviewStatus } from "@/lib/admin/marketplace-actions";
import { requireAdmin, type Row } from "@/lib/admin/data";
import { formatPeso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AdminLoading } from "@/components/admin/loading";

type Props = PageProps<"/[locale]/admin/marketplace">;
const field = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 text-base";

export default function AdminMarketplacePage(props: Props) {
  return <Suspense fallback={<AdminLoading />}><Market {...props} /></Suspense>;
}

async function Market({ params }: Props) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const [listings, reviews, fees, settings] = await Promise.all([
    supabase.from("cpa_listings").select("*").order("status").order("created_at"),
    supabase.from("cpa_reviews").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("platform_fees").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("marketplace_settings").select("fee_rate").maybeSingle(),
  ]);
  const names = new Map(((listings.data ?? []) as Row[]).map((l) => [String(l.user_id), String(l.display_name)]));
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Listings</h1>
        <p className="text-sm text-muted-foreground">Before verifying, check the license on the PRC online verification service (name, license number, profession, validity). Verifying a listing does not give the person the &ldquo;cpa&rdquo; role used for tax rule reviews.</p>
        <ul className="space-y-3">
          {((listings.data ?? []) as Row[]).map((l) => (
            <li key={String(l.user_id)} className="space-y-2 rounded-lg border bg-card p-4">
              <p className="font-bold">{String(l.display_name)} <span className="text-sm font-normal text-muted-foreground">({String(l.profession)}, {String(l.status)})</span></p>
              <p className="text-sm">License {String(l.prc_license_no ?? "none")}{l.license_valid_until ? `, valid until ${String(l.license_valid_until)}` : ""} · {String(l.contact_email)}</p>
              {l.bio ? <p className="text-sm">{String(l.bio)}</p> : null}
              <form action={setListingStatus} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="userId" value={String(l.user_id)} />
                <label className="flex-1 space-y-1 text-sm"><span className="font-semibold">Note to the professional (optional)</span><input name="note" maxLength={500} className={field} /></label>
                <Button type="submit" size="sm" name="status" value="verified">Verify</Button>
                <Button type="submit" size="sm" variant="outline" name="status" value="rejected">Reject</Button>
                <Button type="submit" size="sm" variant="ghost" name="status" value="suspended">Suspend</Button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Platform fee</h2>
        <form action={setFeeRate} className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-end">
          <input type="hidden" name="locale" value={locale} />
          <label className="flex-1 space-y-1 text-sm"><span className="font-semibold">Fee rate (% of the final fee, applies to engagements completed from now on)</span><input name="percent" inputMode="decimal" defaultValue={String(Number(settings.data?.fee_rate ?? 0) * 100)} className={field} /></label>
          <Button type="submit" size="sm">Save</Button>
        </form>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted"><tr><th className="p-2">Professional</th><th className="p-2">Final fee</th><th className="p-2">Platform fee</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
            <tbody>{((fees.data ?? []) as Row[]).map((f) => (
              <tr key={String(f.request_id)} className="border-t">
                <td className="p-2">{names.get(String(f.cpa_user_id)) ?? ""}</td><td className="p-2">{formatPeso(Number(f.base_fee_php))}</td><td className="p-2">{formatPeso(Number(f.fee_php))} ({Number(f.fee_rate) * 100}%)</td><td className="p-2">{String(f.status)}</td>
                <td className="p-2"><form action={setFeeStatus} className="flex gap-1"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="requestId" value={String(f.request_id)} /><Button type="submit" size="sm" variant="ghost" name="status" value="paid">Paid</Button><Button type="submit" size="sm" variant="ghost" name="status" value="waived">Waive</Button></form></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Reviews</h2>
        <ul className="divide-y rounded-lg border bg-card">{((reviews.data ?? []) as Row[]).map((r) => (
          <li key={String(r.request_id)} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 text-sm"><span className="font-semibold">{names.get(String(r.cpa_user_id)) ?? ""}</span> · {"★".repeat(Number(r.rating))} · {String(r.comment ?? "")} <span className="text-muted-foreground">({String(r.status)})</span></span>
            <form action={setReviewStatus}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="requestId" value={String(r.request_id)} /><Button type="submit" size="sm" variant="ghost" name="status" value={r.status === "hidden" ? "published" : "hidden"}>{r.status === "hidden" ? "Show" : "Hide"}</Button></form>
          </li>
        ))}</ul>
      </section>
    </div>
  );
}
