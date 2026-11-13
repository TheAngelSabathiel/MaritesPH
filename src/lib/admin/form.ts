/**
 * Converts submitted form fields into typed values according to the resource's
 * field definitions, then validates with the resource schema.
 * Pure (takes a getter), so it is unit-testable without a request.
 */
import { hoursFromFields } from "@/lib/content/hours";
import { allFields, type ResourceDef } from "./resources";
import { schemas } from "./schemas";

export type FieldErrors = Record<string, string>;
export type ParseResult =
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; errors: FieldErrors };

type Getter = (name: string) => string | null;

function toNumber(raw: string | null): number | null | string {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : raw; // keep bad input so validation reports it
}

function toText(raw: string | null): string | null {
  const v = raw?.trim() ?? "";
  return v === "" ? null : v;
}

export function parseRecordForm(resource: ResourceDef, get: Getter): ParseResult {
  const raw: Record<string, unknown> = {};

  for (const field of allFields(resource)) {
    const value = get(field.name);
    switch (field.kind) {
      case "number":
      case "money":
        raw[field.name] = toNumber(value);
        break;
      case "checkbox":
        raw[field.name] = value === "on" || value === "true";
        break;
      case "tristate":
        raw[field.name] = value === "yes" ? true : value === "no" ? false : null;
        break;
      case "tags":
        raw[field.name] = (value ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        break;
      case "hours":
        raw[field.name] = hoursFromFields(get);
        break;
      case "select":
        raw[field.name] = field.name === "source_rank" ? toNumber(value) : toText(value);
        break;
      case "json": {
        const text = value?.trim() ?? "";
        try {
          raw[field.name] = text ? JSON.parse(text) : null;
        } catch {
          raw[field.name] = "__invalid_json__"; // reported as a field error by the schema
        }
        break;
      }
      case "target": {
        const [type, id] = (value ?? "").split(":");
        raw.target_type = type || null;
        raw.target_id = id || null;
        break;
      }
      default:
        raw[field.name] = toText(value);
    }
  }

  if (resource.parent) raw[resource.parent.column] = toText(get(resource.parent.column));

  const parsed = schemas[resource.key].safeParse(raw);
  if (parsed.success) return { ok: true, values: parsed.data };

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    let name = String(issue.path[0] ?? "_form");
    if (name === "target_type" || name === "target_id") name = "target";
    errors[name] ??= issue.message;
  }
  return { ok: false, errors };
}
