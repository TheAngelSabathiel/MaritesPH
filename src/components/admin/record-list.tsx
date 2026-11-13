import Link from "next/link";
import { getFreshness } from "@/lib/content/freshness";
import { StatusBadge } from "./status-badge";

export type ListRow = {
  id: string;
  href: string;
  label: string;
  status: string;
  lastVerifiedAt: string | null;
  toVerify: boolean;
  columns: { label: string; value: string }[];
};

/**
 * Responsive list: stacked cards on phones, a table from md up.
 * Both views come from the same data; only one is visible at a time.
 */
export function RecordList({
  rows,
  now,
  staleDays,
  empty,
  columnLabels,
}: {
  rows: ListRow[];
  now: Date;
  staleDays: number;
  empty: string;
  columnLabels: string[];
}) {
  if (rows.length === 0) {
    return <p className="rounded-md border border-dashed p-6 text-muted-foreground">{empty}</p>;
  }

  const verified = (r: ListRow) => {
    const f = getFreshness(r.lastVerifiedAt, now, staleDays);
    if (f.state === "unverified") return { text: "Never verified", stale: false };
    return { text: `${f.ageDays} days ago`, stale: f.state === "stale" };
  };

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => {
          const v = verified(r);
          return (
            <li key={r.id}>
              <Link href={r.href} className="block rounded-lg border bg-card p-4 active:bg-muted">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold leading-snug">{r.label}</span>
                  <StatusBadge status={r.status} />
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {r.columns.map((c) => (
                    <div key={c.label} className="contents">
                      <dt>{c.label}</dt>
                      <dd className="min-w-0 break-words">{c.value || "–"}</dd>
                    </div>
                  ))}
                  <dt>Verified</dt>
                  <dd className={v.stale ? "font-semibold text-caution" : undefined}>{v.text}</dd>
                </dl>
                {r.toVerify ? <p className="mt-2 text-sm font-semibold text-caution">Has open TO VERIFY items</p> : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Name</th>
              {columnLabels.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-semibold">{c}</th>
              ))}
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Verified</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-card">
            {rows.map((r) => {
              const v = verified(r);
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <Link href={r.href} className="font-semibold text-primary underline-offset-2 hover:underline">
                      {r.label}
                    </Link>
                    {r.toVerify ? <span className="ml-2 text-xs font-semibold text-caution">TO VERIFY</span> : null}
                  </td>
                  {r.columns.map((c) => (
                    <td key={c.label} className="px-4 py-3">{c.value || "–"}</td>
                  ))}
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className={v.stale ? "px-4 py-3 font-semibold text-caution" : "px-4 py-3"}>{v.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
