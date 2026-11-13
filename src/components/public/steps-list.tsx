import type { Messages } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import type { PublicStep } from "@/lib/content/public";

/** Numbered guide steps with online/in-person and time estimates. Anchors #step-N match the HowTo data. */
export function StepsList({ steps, t }: { steps: PublicStep[]; t: Messages }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={step.id} id={`step-${i + 1}`} className="flex gap-3 rounded-lg border bg-card p-4">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {i + 1}
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-bold leading-snug">{step.title}</h3>
            {step.body_md ? <p className="whitespace-pre-line break-words">{step.body_md}</p> : null}
            <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
              <span>{step.is_online ? t.guides.online : t.guides.inPerson}</span>
              {step.estimated_minutes ? <span>{format(t.guides.aboutMinutes, { minutes: step.estimated_minutes })}</span> : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
