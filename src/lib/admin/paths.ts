/** URL helpers for the admin panel. Pure. */
import type { ResourceDef } from "./resources";

export function adminPath(locale: string, ...segments: string[]): string {
  return ["", locale, "admin", ...segments].join("/");
}

export function recordPath(locale: string, resource: ResourceDef, id: string): string {
  return adminPath(locale, resource.slug, id);
}

export function newRecordPath(
  locale: string,
  resource: ResourceDef,
  parent?: { id: string; type?: string },
): string {
  const base = adminPath(locale, resource.slug, "new");
  if (!parent) return base;
  const params = new URLSearchParams({ parent: parent.id });
  if (parent.type) params.set("parent_type", parent.type);
  return `${base}?${params}`;
}

/** Append a notice or error message to a path for display after redirect. */
export function withMessage(path: string, kind: "notice" | "error", message: string): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(kind, message.slice(0, 300));
  return `${base}?${params}`;
}
