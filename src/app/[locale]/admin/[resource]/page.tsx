import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { listRecords, requireAdmin } from "@/lib/admin/data";
import { adminPath, newRecordPath, recordPath } from "@/lib/admin/paths";
import { resourceBySlug } from "@/lib/admin/resources";
import { STATUSES } from "@/lib/admin/workflow";
import { serverEnv } from "@/lib/env.server";
import { buttonVariants } from "@/components/ui/button";
import { AdminLoading } from "@/components/admin/loading";
import { RecordList } from "@/components/admin/record-list";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/admin/[resource]">;

export default function ResourceListPage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <ResourceList {...props} />
    </Suspense>
  );
}

async function ResourceList({ params, searchParams }: Props) {
  const { locale, resource: slug } = await params;
  const resource = resourceBySlug(slug);
  if (!resource || !resource.topLevel) notFound();
  const { supabase } = await requireAdmin(locale);

  const sp = await searchParams;
  const status = typeof sp.status === "string" && (STATUSES as readonly string[]).includes(sp.status) ? sp.status : undefined;
  const rows = await listRecords(supabase, resource, { status });

  const filters = [{ value: undefined, label: "All" }, ...STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{resource.plural}</h1>
        <Link href={newRecordPath(locale, resource)} className={buttonVariants({ size: "sm" })}>
          New {resource.singular.toLowerCase()}
        </Link>
      </div>

      <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-2">
          {filters.map((f) => (
            <li key={f.label}>
              <Link
                href={f.value ? `${adminPath(locale, slug)}?status=${f.value}` : adminPath(locale, slug)}
                aria-current={status === f.value ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
                  status === f.value ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                )}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <RecordList
        now={new Date()}
        staleDays={serverEnv().CONTENT_STALE_DAYS}
        empty={status ? `No ${status} ${resource.plural.toLowerCase()}.` : `No ${resource.plural.toLowerCase()} yet.`}
        columnLabels={resource.listColumns.map((c) => c.label)}
        rows={rows.map((r) => ({
          id: String(r.id),
          href: recordPath(locale, resource, String(r.id)),
          label: String(r[resource.labelColumn] ?? "(untitled)"),
          status: String(r.status),
          lastVerifiedAt: (r.last_verified_at as string | null) ?? null,
          toVerify: Boolean(r.to_verify_note),
          columns: resource.listColumns.map((c) => ({ label: c.label, value: r[c.name] == null ? "" : String(r[c.name]) })),
        }))}
      />
    </section>
  );
}
