import Link from "next/link";
import type { Messages } from "@/i18n/dictionaries";
import { hasWeekendHours } from "@/lib/content/hours";
import { officePath, type PublicOffice } from "@/lib/content/offices";
import { OpenStatusBadge } from "./open-status";

/** One office in a list: name, agency, address, open status, and key badges. */
export function OfficeCard({
  office,
  locale,
  t,
  distanceText,
}: {
  office: PublicOffice;
  locale: string;
  /** Only the office strings, so client pages don't ship the whole message file. */
  t: Messages["offices"];
  distanceText?: string | null;
}) {
  return (
    <article className="rounded-lg border bg-card p-4">
      <p className="text-sm font-semibold text-muted-foreground">{office.agency.acronym ?? office.agency.name}</p>
      <h3 className="text-lg font-bold leading-snug">
        <Link href={officePath(locale, office)} className="underline-offset-2 hover:underline">
          {office.name}
        </Link>
      </h3>
      {office.address ? <p className="break-words text-sm">{office.address}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <OpenStatusBadge hours={office.hours} t={t} />
        {distanceText ? <span className="text-sm font-semibold">{distanceText}</span> : null}
      </div>
      <ul className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
        {hasWeekendHours(office.hours) ? <li className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{t.weekendBadge}</li> : null}
        <li className="rounded-full bg-muted px-2 py-0.5">
          {office.acceptsWalkIn === true ? t.walkInYes : office.acceptsWalkIn === false ? t.walkInNo : t.walkInUnknown}
        </li>
      </ul>
    </article>
  );
}
