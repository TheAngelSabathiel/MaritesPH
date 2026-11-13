import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";

export type ChildItem = { id: string; href: string; label: string; status: string; note?: string | null; meta?: string };

/** A titled list of child records with an "Add" button. Same layout on all screen sizes. */
export function ChildSection({
  title,
  description,
  addHref,
  addLabel,
  items,
  children,
}: {
  title: string;
  description?: string;
  addHref: string;
  addLabel: string;
  items?: ChildItem[];
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Link href={addHref} className={buttonVariants({ size: "sm", variant: "outline" })}>
          {addLabel}
        </Link>
      </div>
      {children}
      {items ? (
        items.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ChildItems items={items} />
        )
      ) : null}
    </section>
  );
}

export function ChildItems({ items }: { items: ChildItem[] }) {
  return (
    <ul className="divide-y rounded-md border">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} className="flex min-h-11 flex-col items-start gap-1 p-3 active:bg-muted sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 break-words font-medium">
              {item.label}
              {item.meta ? <span className="ml-2 text-sm text-muted-foreground">{item.meta}</span> : null}
              {item.note ? <span className="mt-0.5 block text-sm text-caution">{item.note}</span> : null}
            </span>
            <StatusBadge status={item.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
