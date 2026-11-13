/**
 * PayMongo webhook signature (per PayMongo's docs): header
 * "Paymongo-Signature: t=<unix>,te=<test sig>,li=<live sig>", where each sig is
 * HMAC-SHA256(key = webhook secret "whsk_...", message = `${t}.${rawBody}`),
 * hex. Compare `te` in test mode and `li` in live mode, in constant time.
 *
 * Timestamp window: 72 h by default. PayMongo retries failed deliveries up to
 * 12 times with backoff, so a tight window could reject genuine retries;
 * replays are harmless anyway because each event is applied at most once
 * (webhook_events) and each payment at most once (apply_payment).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_TOLERANCE_SECONDS = 72 * 3600;

export function parseSignatureHeader(header: string | null): { t: number; te: string; li: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return i < 0 ? [p.trim(), ""] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isInteger(t) || t <= 0) return null;
  return { t, te: parts.te ?? "", li: parts.li ?? "" };
}

export function sign(rawBody: string, t: number, secret: string): string {
  return createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
}

export type SignatureCheck = "ok" | "missing" | "malformed" | "mismatch" | "stale";

export function verifySignature(input: { rawBody: string; header: string | null; secret: string; livemode: boolean; nowSeconds: number; toleranceSeconds?: number }): SignatureCheck {
  if (!input.header) return "missing";
  const h = parseSignatureHeader(input.header);
  if (!h) return "malformed";
  const given = input.livemode ? h.li : h.te;
  if (!/^[0-9a-f]{64}$/i.test(given)) return "mismatch";
  const expected = Buffer.from(sign(input.rawBody, h.t, input.secret), "hex");
  const actual = Buffer.from(given, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return "mismatch";
  if (Math.abs(input.nowSeconds - h.t) > (input.toleranceSeconds ?? SIGNATURE_TOLERANCE_SECONDS)) return "stale";
  return "ok";
}
