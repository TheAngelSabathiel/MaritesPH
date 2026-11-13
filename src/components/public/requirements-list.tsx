import Link from "next/link";
import type { Messages } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import type { PublicRequirement } from "@/lib/content/public";
import { humanizeKey, type RequirementGroup } from "@/lib/content/requirements";

/**
 * Requirements in plain terms: numbered groups (all required); groups with
 * several options say "bring ONE of these choices". Plain, serious wording.
 */
export function RequirementsList({
  groups,
  locale,
  t,
}: {
  groups: RequirementGroup<PublicRequirement>[];
  locale: string;
  t: Messages;
}) {
  return (
    <ol className="space-y-4">
      {groups.map((group, gi) => {
        const choices = group.options.length > 1;
        return (
          <li key={group.groupKey} className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold text-muted-foreground">
              {gi + 1}. {humanizeKey(group.groupKey)}
            </p>
            <p className="mb-2 font-bold">{choices ? t.guides.groupOneOf : t.guides.groupAllOf}</p>
            {choices ? (
              <ol className="space-y-3">
                {group.options.map((option, oi) => (
                  <li key={option.optionKey} className="rounded-md border-l-4 border-l-folder bg-muted/50 py-2 pl-3 pr-2">
                    <p className="text-sm font-semibold">
                      {format(t.guides.choice, { n: oi + 1 })}
                      {option.items.length > 1 ? `: ${t.guides.allOfThese}` : ""}
                    </p>
                    <Items items={option.items} locale={locale} t={t} />
                  </li>
                ))}
              </ol>
            ) : (
              <Items items={group.options[0]?.items ?? []} locale={locale} t={t} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Items({ items, locale, t }: { items: PublicRequirement[]; locale: string; t: Messages }) {
  return (
    <ul className="mt-1 list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item.id} className="break-words">
          {item.requires_document_id ? (
            item.requiredDocument ? (
              <>
                <span className="font-semibold">{item.requiredDocument.name}</span>{" "}
                <Link href={`/${locale}/ids/${item.requiredDocument.slug}`} className="inline-flex min-h-11 items-center text-sm text-primary underline sm:min-h-0">
                  {t.guides.seeGuide}
                </Link>
              </>
            ) : (
              <span>{t.guides.requiredDocumentHidden}</span>
            )
          ) : (
            <span>{item.requirement_text}</span>
          )}
          {item.quantity > 1 ? <span className="text-muted-foreground"> ({format(t.guides.quantity, { count: item.quantity })})</span> : null}
          {item.notes ? <span className="block text-sm text-muted-foreground">{item.notes}</span> : null}
        </li>
      ))}
    </ul>
  );
}
