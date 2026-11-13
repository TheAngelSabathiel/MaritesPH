import Link from "next/link";
import type { Row } from "@/lib/admin/data";
import { recordPath } from "@/lib/admin/paths";
import { resourceForTargetType } from "@/lib/admin/resources";
import { StatusBadge } from "./status-badge";

const TYPE_LABELS: Record<string, string> = {
  agency: "Agency",
  document: "Document",
  document_requirement: "Requirement",
  accepted_for: "Accepted for",
  guide_step: "Guide step",
  office: "Office",
  office_service: "Office service",
  lgu_process: "LGU process",
  tax_rule: "Tax rule",
  tax_deadline: "Tax deadline",
  legal_reference: "Legal reference",
};

export function typeLabel(type: string) {
  return TYPE_LABELS[type] ?? type;
}

/** Link to the page that edits a content_index row (its own page for children too). */
export function indexHref(locale: string, row: Row): string | null {
  const own = resourceForTargetType(String(row.target_type));
  if (own) return recordPath(locale, own, String(row.id));
  const parent = resourceForTargetType(String(row.parent_type));
  return parent ? recordPath(locale, parent, String(row.parent_id)) : null;
}

/** Rows from content_index as cards (all screen sizes). `aside` renders extra controls. */
export function IndexRows({
  rows,
  locale,
  empty,
  detail,
  aside,
}: {
  rows: Row[];
  locale: string;
  empty: string;
  detail?: (row: Row) => React.ReactNode;
  aside?: (row: Row) => React.ReactNode;
}) {
  if (rows.length === 0) return <p className="rounded-md border border-dashed p-6 text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const href = indexHref(locale, row);
        return (
          <li key={`${String(row.target_type)}:${String(row.id)}`} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{typeLabel(String(row.target_type))}</p>
                {href ? (
                  <Link href={href} className="break-words font-semibold text-primary underline-offset-2 hover:underline">
                    {String(row.label)}
                  </Link>
                ) : (
                  <span className="break-words font-semibold">{String(row.label)}</span>
                )}
              </div>
              <StatusBadge status={String(row.status)} />
            </div>
            {detail ? <div className="mt-2 text-sm">{detail(row)}</div> : null}
            {aside ? <div className="mt-3">{aside(row)}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
