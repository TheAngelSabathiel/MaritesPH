import Link from "next/link";

/** Visible breadcrumb trail (structured data is emitted separately by the page). */
export function Breadcrumbs({ items, label }: { items: { name: string; href?: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-1 text-muted-foreground">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="inline-flex min-h-11 min-w-11 items-center underline-offset-2 hover:underline">
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="inline-flex min-h-11 items-center font-semibold text-foreground">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
