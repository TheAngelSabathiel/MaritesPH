/**
 * Tiny string interpolation for message templates: "Hi {name}" + {name: "Juan"}.
 * Unknown placeholders are left as-is so missing values are visible in QA
 * instead of silently disappearing.
 */
export function format(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}
