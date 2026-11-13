"use client";

/**
 * Generic admin form, driven by a ResourceDef. One column on phones, two on
 * wider screens for "half" fields. Submits to the saveRecord Server Action.
 */
import { useActionState, useId } from "react";
import type { FieldDef, ResourceDef } from "@/lib/admin/resources";
import { allFields } from "@/lib/admin/resources";
import { saveRecord, type SaveState } from "@/lib/admin/actions";
import { DAYS, DAY_LABELS } from "@/lib/content/hours-core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };
type Values = Record<string, unknown>;

const controlClass =
  "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base placeholder:text-muted-foreground";

export function RecordForm({
  resource,
  locale,
  id,
  values,
  options,
  parentValue,
  showReverify,
}: {
  resource: ResourceDef;
  locale: string;
  id?: string;
  values: Values;
  /** Options for reference/target fields, keyed by field name. */
  options: Record<string, Option[]>;
  /** Fixed parent id for child resources. */
  parentValue?: string;
  /** Record is verified/published: offer "I re-checked the source". */
  showReverify: boolean;
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveRecord, {});
  const reverifyId = useId();

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="resource" value={resource.slug} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {resource.parent && parentValue ? (
        <input type="hidden" name={resource.parent.column} value={parentValue} />
      ) : null}

      {state.formError ? <Alert tone="caution">{state.formError}</Alert> : null}
      {state.errors && Object.keys(state.errors).length > 0 ? (
        <Alert tone="caution">Please fix the highlighted fields.</Alert>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {allFields(resource).map((field) => (
          <Field
            key={field.name}
            field={field}
            value={field.kind === "target" ? targetValue(values) : values[field.name]}
            error={state.errors?.[field.name]}
            options={options[field.name] ?? field.options ?? []}
          />
        ))}
      </div>

      {showReverify ? (
        <div className="flex items-start gap-3 rounded-md border border-stamp/40 bg-stamp-soft p-3">
          <input id={reverifyId} name="reverified" type="checkbox" className="mt-1 size-5 shrink-0" />
          <label htmlFor={reverifyId} className="text-sm leading-relaxed">
            I re-checked every changed fact against the official source just now. Without this, changing a
            fact sends the record back to draft.
          </label>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : id ? "Save changes" : `Create ${resource.singular.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}

function targetValue(values: Values): string {
  return values.target_type && values.target_id ? `${String(values.target_type)}:${String(values.target_id)}` : "";
}

function Field({
  field,
  value,
  error,
  options,
}: {
  field: FieldDef;
  value: unknown;
  error?: string;
  options: Option[];
}) {
  const id = useId();
  const describedBy = [field.help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const wide = !field.half || field.kind === "hours" || field.kind === "textarea" || field.kind === "json";
  const invalid = error ? "border-destructive" : "";

  if (field.kind === "hours") {
    // min-w-0: fieldsets default to min-width:min-content and would overflow narrow screens.
    return (
      <fieldset className="min-w-0 space-y-3 md:col-span-2" aria-describedby={describedBy}>
        <legend className="text-sm font-semibold">{field.label}</legend>
        <HoursEditor name={field.name} value={value} />
        <FieldMessages id={id} help="Leave a day empty if the office is closed. Use the second pair for a lunch break." error={error} />
      </fieldset>
    );
  }

  if (field.kind === "checkbox") {
    return (
      <div className={cn("flex items-start gap-3", wide && "md:col-span-2")}>
        <input id={id} name={field.name} type="checkbox" defaultChecked={value === true} className="mt-1 size-5 shrink-0" />
        <div>
          <Label htmlFor={id}>{field.label}</Label>
          <FieldMessages id={id} help={field.help} error={error} />
        </div>
      </div>
    );
  }

  let control: React.ReactNode;
  const common = { id, name: field.name, "aria-invalid": Boolean(error), "aria-describedby": describedBy };

  switch (field.kind) {
    case "json":
      control = (
        <textarea {...common} rows={8} spellCheck={false} defaultValue={value == null ? "" : JSON.stringify(value, null, 2)}
          className={cn(controlClass, "min-h-40 font-mono text-sm", invalid)} />
      );
      break;
    case "textarea":
      control = (
        <textarea {...common} rows={field.name === "body_md" ? 6 : 3} defaultValue={value == null ? "" : String(value)}
          placeholder={field.placeholder} className={cn(controlClass, "min-h-24", invalid)} />
      );
      break;
    case "select":
    case "reference":
    case "target":
    case "tristate": {
      const opts =
        field.kind === "tristate"
          ? [
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]
          : options;
      const current =
        field.kind === "tristate" ? (value === true ? "yes" : value === false ? "no" : "") : value == null ? "" : String(value);
      control = (
        <select {...common} defaultValue={current} className={cn(controlClass, invalid)}>
          <option value="">{field.kind === "tristate" ? "Unknown" : field.required ? "Choose…" : "None"}</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    default: {
      const type = field.kind === "url" ? "url" : field.kind === "date" ? "date" : "text";
      const inputMode = field.kind === "number" || field.kind === "money" ? "decimal" : field.kind === "url" ? "url" : undefined;
      const display = Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value);
      control = (
        <Input {...common} type={type} inputMode={inputMode} defaultValue={display} placeholder={field.placeholder} className={invalid} />
      );
    }
  }

  return (
    <div className={cn("space-y-2", wide && "md:col-span-2")}>
      <Label htmlFor={id}>
        {field.label}
        {field.required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      {control}
      <FieldMessages id={id} help={field.help} error={error} />
    </div>
  );
}

function FieldMessages({ id, help, error }: { id: string; help?: string; error?: string }) {
  return (
    <>
      {help ? (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Weekly hours: one row per day; stacks on phones. */
function HoursEditor({ name, value }: { name: string; value: unknown }) {
  const hours = (value && typeof value === "object" ? value : {}) as Record<string, [string, string][]>;
  return (
    <div className="divide-y rounded-md border" data-field={name}>
      {DAYS.map((day) => {
        const [first, second] = hours[day] ?? [];
        return (
          <div key={day} className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-[7rem_1fr_1fr] lg:items-center">
            <span className="text-sm font-semibold sm:col-span-2 lg:col-span-1">{DAY_LABELS[day]}</span>
            <TimePair day={day} suffix="" pair={first} label="Hours" />
            <TimePair day={day} suffix="2" pair={second} label="Second hours" />
          </div>
        );
      })}
    </div>
  );
}

function TimePair({ day, suffix, pair, label }: { day: string; suffix: string; pair?: [string, string]; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Input type="time" name={`${day}_open${suffix}`} defaultValue={pair?.[0] ?? ""} aria-label={`${DAY_LABELS[day as keyof typeof DAY_LABELS]} ${label.toLowerCase()} open`} className="min-w-0" />
      <span aria-hidden="true" className="text-muted-foreground">to</span>
      <Input type="time" name={`${day}_close${suffix}`} defaultValue={pair?.[1] ?? ""} aria-label={`${DAY_LABELS[day as keyof typeof DAY_LABELS]} ${label.toLowerCase()} close`} className="min-w-0" />
    </div>
  );
}
