import { transitionRecord, deleteRecord } from "@/lib/admin/actions";
import type { ResourceDef } from "@/lib/admin/resources";
import { allowedTransitions, canDelete, transitionLabel, type VerificationState } from "@/lib/admin/workflow";
import { formatPhDate } from "@/lib/content/freshness";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";

/** Status, verification info, and the allowed next steps for one record. */
export function WorkflowPanel({
  resource,
  id,
  state,
  locale,
  compact = false,
}: {
  resource: ResourceDef;
  id: string;
  state: VerificationState;
  locale: "en" | "fil";
  compact?: boolean;
}) {
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="resource" value={resource.slug} />
      <input type="hidden" name="id" value={id} />
    </>
  );

  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-lg border bg-card p-4"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <StatusBadge status={state.status} />
        <span className="text-muted-foreground">
          {state.last_verified_at ? `Last verified ${formatPhDate(state.last_verified_at, locale)}` : "Never verified"}
        </span>
        {state.source_url ? (
          <a href={state.source_url} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">
            Source
          </a>
        ) : (
          <span className="font-semibold text-caution">No source</span>
        )}
      </div>
      {state.to_verify_note ? (
        <p className="rounded-md bg-caution-soft px-3 py-2 text-sm">{state.to_verify_note}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {allowedTransitions(state.status).map((to) => (
          <form key={to} action={transitionRecord}>
            {hidden}
            <input type="hidden" name="to" value={to} />
            <Button type="submit" size="sm" variant={to === "published" || to === "verified" ? "default" : "outline"}>
              {transitionLabel(state.status, to)}
            </Button>
          </form>
        ))}
        {canDelete(state) ? (
          <form action={deleteRecord}>
            {hidden}
            <Button type="submit" size="sm" variant="ghost" className="text-destructive">
              Delete draft
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
