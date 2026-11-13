import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  draft: "bg-muted text-foreground",
  verified: "bg-accent text-accent-foreground",
  published: "bg-stamp-soft text-stamp",
  archived: "bg-muted text-muted-foreground line-through",
  open: "bg-caution-soft text-caution",
  resolved: "bg-stamp-soft text-stamp",
  dismissed: "bg-muted text-muted-foreground",
};

/** Workflow status pill. Text, not just color, so it works without color vision. */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize", styles[status] ?? styles.draft)}>
      {status}
    </span>
  );
}
