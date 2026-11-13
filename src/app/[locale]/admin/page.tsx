import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/data";
import { adminPath } from "@/lib/admin/paths";
import { serverEnv } from "@/lib/env.server";
import { staleCutoffIso } from "@/lib/admin/time";
import { spendThisMonth } from "@/lib/ai/client";
import { aiSettings } from "@/lib/ai/config";
import { AdminLoading } from "@/components/admin/loading";

export default function AdminDashboardPage(props: PageProps<"/[locale]/admin">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Dashboard params={props.params} />
    </Suspense>
  );
}

async function Dashboard({ params }: { params: PageProps<"/[locale]/admin">["params"] }) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);
  const staleDays = serverEnv().CONTENT_STALE_DAYS;
  const cutoff = staleCutoffIso(staleDays);

  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const index = () => supabase.from("content_index").select("id", { count: "exact", head: true });
  const [spent, pendingTips] = await Promise.all([
    spendThisMonth(),
    count(supabase.from("tips").select("id", { count: "exact", head: true }).eq("status", "pending")),
  ]);
  const ai = aiSettings();
  const [toVerify, drafts, ready, published, stale, flags] = await Promise.all([
    count(index().not("to_verify_note", "is", null).neq("status", "archived")),
    count(index().eq("status", "draft")),
    count(index().eq("status", "verified")),
    count(index().eq("status", "published")),
    count(index().in("status", ["verified", "published"]).lt("last_verified_at", cutoff)),
    count(supabase.from("content_flags").select("id", { count: "exact", head: true }).eq("status", "open")),
  ]);

  const cards = [
    { label: "Open TO VERIFY items", value: toVerify, href: adminPath(locale, "queue"), urgent: toVerify > 0 },
    { label: "Verified, ready to publish", value: ready, href: `${adminPath(locale, "queue")}#ready`, urgent: false },
    { label: `Stale (over ${staleDays} days)`, value: stale, href: adminPath(locale, "stale"), urgent: stale > 0 },
    { label: "Open flags", value: flags, href: adminPath(locale, "flags"), urgent: flags > 0 },
    { label: "Tips waiting for review", value: pendingTips, href: adminPath(locale, "tips"), urgent: pendingTips > 0 },
    { label: "Drafts", value: drafts, href: `${adminPath(locale, "documents")}?status=draft`, urgent: false },
    { label: "Published records", value: published, href: `${adminPath(locale, "documents")}?status=published`, urgent: false },
  ];

  return (
    <section aria-labelledby="dash" className="space-y-4">
      <h1 id="dash" className="text-2xl font-extrabold tracking-tight">Content health</h1>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.label}>
            <Link
              href={c.href}
              className={`flex h-full flex-col justify-between gap-2 rounded-lg border bg-card p-4 active:bg-muted ${c.urgent ? "border-caution/50" : ""}`}
            >
              <span className={`text-3xl font-extrabold ${c.urgent ? "text-caution" : ""}`}>{c.value}</span>
              <span className="text-sm font-semibold leading-snug">{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-bold">AI this month</h2>
        <p className="text-sm">
          {!ai.enabled
            ? "AI features are off (not configured). Chika sa Pila serves cached answers only; plan summaries are hidden."
            : `US$${(spent ?? 0).toFixed(2)} of US$${ai.monthlyBudgetUsd.toFixed(2)} budget used (model ${ai.model}).`}
        </p>
      </section>
      <p className="text-sm text-muted-foreground">
        Counts include every content record (documents, requirements, steps, offices, services, legal references).
      </p>
    </section>
  );
}
