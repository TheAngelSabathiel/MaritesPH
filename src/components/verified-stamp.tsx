import { cn } from "@/lib/utils";

/**
 * "Verified ni Marites" mark, drawn as a rubber stamp. This is the app's
 * signature visual element and is reserved for content that is actually
 * verified (status published + source + last_verified_at). Never use it for
 * community content.
 */
export function VerifiedStamp({
  label,
  dateText,
  sourceHref,
  sourceLabel,
  sampleLabel,
  className,
}: {
  label: string;
  dateText: string;
  sourceHref?: string;
  sourceLabel?: string;
  /** When set, marks the stamp as a non-factual design sample. */
  sampleLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex -rotate-2 flex-col gap-0.5 rounded-md border-[3px] border-double border-stamp px-3 py-2 text-stamp",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-extrabold tracking-wide">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
          <path d="M6.4 11.6 2.8 8l1.1-1.1 2.5 2.5 5.7-5.7 1.1 1.1z" />
        </svg>
        {label}
        {sampleLabel ? (
          <span className="ml-1 rounded-sm bg-stamp-soft px-1.5 text-xs font-semibold">{sampleLabel}</span>
        ) : null}
      </span>
      <span className="text-xs font-medium">{dateText}</span>
      {sourceHref && sourceLabel ? (
        <a
          href={sourceHref}
          className="text-xs font-semibold underline underline-offset-2"
          rel="noopener noreferrer"
          target="_blank"
        >
          {sourceLabel}
        </a>
      ) : null}
    </div>
  );
}
