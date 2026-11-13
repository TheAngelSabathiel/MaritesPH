import { Suspense } from "react";
import { requireAdmin, type Row } from "@/lib/admin/data";
import { AdminLoading } from "@/components/admin/loading";
import { IndexRows } from "@/components/admin/index-rows";

type Props = PageProps<"/[locale]/admin/queue">;

export default function QueuePage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Queue {...props} />
    </Suspense>
  );
}

async function Queue({ params }: Props) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const [toVerify, ready] = await Promise.all([
    supabase
      .from("content_index")
      .select("*")
      .not("to_verify_note", "is", null)
      .neq("status", "archived")
      .order("updated_at", { ascending: true })
      .limit(300),
    supabase.from("content_index").select("*").eq("status", "verified").order("last_verified_at", { ascending: true }).limit(300),
  ]);
  const toVerifyRows = (toVerify.data ?? []) as Row[];
  const readyRows = (ready.data ?? []) as Row[];

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="to-verify">
        <h1 id="to-verify" className="text-2xl font-extrabold tracking-tight">
          TO VERIFY ({toVerifyRows.length})
        </h1>
        <p className="text-sm text-muted-foreground">
          Oldest first. Check each item against its official source, correct it, clear the note, then mark it verified.
        </p>
        <IndexRows
          rows={toVerifyRows}
          locale={locale}
          empty="Nothing waiting for verification."
          detail={(r) => <p className="rounded-md bg-caution-soft px-3 py-2">{String(r.to_verify_note)}</p>}
        />
      </section>

      <section className="space-y-3" aria-labelledby="ready" id="ready">
        <h2 className="text-xl font-bold">Verified, ready to publish ({readyRows.length})</h2>
        <IndexRows rows={readyRows} locale={locale} empty="Nothing waiting to be published." />
      </section>
    </div>
  );
}
