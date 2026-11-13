/**
 * Webhook payload parsing. PayMongo's docs show the event in two shapes:
 *  - classic:  { data: { id: "evt_…", attributes: { type, livemode, data: <resource> } } }
 *  - envelope: { data: { type, livemode, data: <resource> } } (quick-start example)
 * Both are accepted. Only what we need is extracted; everything is optional and
 * validated, so an unexpected payload is ignored rather than trusted.
 */
import { createHash } from "node:crypto";

export type ParsedEvent = {
  key: string; // event id, or a hash of the raw body when no id is present
  type: string;
  livemode: boolean | null;
  sessionId: string | null;
  reference: string | null;
  /** Sum of line item amount × quantity, in centavos (before any pass-on fees). */
  lineItemsTotal: number | null;
};

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export function parseEvent(rawBody: string): ParsedEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const data = obj(obj(body)?.data);
  if (!data) return null;
  const attrs = obj(data.attributes);
  const type = typeof attrs?.type === "string" ? attrs.type : typeof data.type === "string" ? data.type : null;
  if (!type) return null;
  const livemodeRaw = attrs?.livemode ?? data.livemode;
  const resource = obj(attrs?.data) ?? obj(data.data);
  const rAttrs = obj(resource?.attributes);
  const items = Array.isArray(rAttrs?.line_items) ? (rAttrs!.line_items as unknown[]) : null;
  const total = items
    ? items.reduce<number | null>((sum, it) => {
        const o = obj(it);
        const amount = Number(o?.amount);
        const qty = o?.quantity == null ? 1 : Number(o.quantity);
        return sum == null || !Number.isInteger(amount) || !Number.isInteger(qty) ? null : sum + amount * qty;
      }, 0)
    : null;
  const eventId = typeof data.id === "string" && data.id.startsWith("evt_") ? data.id : null;
  return {
    key: eventId ?? `sha256:${createHash("sha256").update(rawBody).digest("hex")}`,
    type,
    livemode: typeof livemodeRaw === "boolean" ? livemodeRaw : null,
    sessionId: typeof resource?.id === "string" ? resource.id : null,
    reference: typeof rAttrs?.reference_number === "string" ? rAttrs.reference_number : null,
    lineItemsTotal: total,
  };
}

export const toCentavos = (php: number) => Math.round(php * 100);
