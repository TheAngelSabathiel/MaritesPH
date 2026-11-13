import { describe, expect, it } from "vitest";
import { parseSignatureHeader, sign, verifySignature } from "@/lib/billing/signature";
import { parseEvent, toCentavos } from "@/lib/billing/webhook";
import { checkoutAllowed, daysLeft, hasAccess } from "@/lib/billing/rules";

const SECRET = "whsk_test_secret_value";
const body = JSON.stringify({ data: { id: "evt_123", type: "event", attributes: { type: "checkout_session.payment.paid", livemode: false, data: { id: "cs_abc", type: "checkout_session", attributes: { reference_number: "11111111-1111-4111-8111-111111111111", line_items: [{ amount: 19900, currency: "PHP", quantity: 3, name: "x" }] } } } } });
const now = 1_800_000_000;

describe("PayMongo signature", () => {
  const sig = sign(body, now, SECRET);
  it("accepts a valid test-mode signature and checks the right slot", () => {
    expect(verifySignature({ rawBody: body, header: `t=${now},te=${sig},li=`, secret: SECRET, livemode: false, nowSeconds: now })).toBe("ok");
    expect(verifySignature({ rawBody: body, header: `t=${now},te=,li=${sig}`, secret: SECRET, livemode: true, nowSeconds: now })).toBe("ok");
    // A test signature doesn't satisfy a live deployment.
    expect(verifySignature({ rawBody: body, header: `t=${now},te=${sig},li=`, secret: SECRET, livemode: true, nowSeconds: now })).toBe("mismatch");
  });
  it("rejects tampering, wrong secrets, bad headers, and stale timestamps", () => {
    expect(verifySignature({ rawBody: body.replace("19900", "100"), header: `t=${now},te=${sig},li=`, secret: SECRET, livemode: false, nowSeconds: now })).toBe("mismatch");
    expect(verifySignature({ rawBody: body, header: `t=${now},te=${sig},li=`, secret: "whsk_other", livemode: false, nowSeconds: now })).toBe("mismatch");
    expect(verifySignature({ rawBody: body, header: null, secret: SECRET, livemode: false, nowSeconds: now })).toBe("missing");
    expect(verifySignature({ rawBody: body, header: "te=abc", secret: SECRET, livemode: false, nowSeconds: now })).toBe("malformed");
    expect(verifySignature({ rawBody: body, header: `t=${now},te=${sig},li=`, secret: SECRET, livemode: false, nowSeconds: now + 73 * 3600 })).toBe("stale");
    expect(verifySignature({ rawBody: body, header: `t=${now},te=${sig},li=`, secret: SECRET, livemode: false, nowSeconds: now + 3600 })).toBe("ok"); // retries within 72 h
    expect(parseSignatureHeader("t=1496734173,te=abc,li=")).toEqual({ t: 1496734173, te: "abc", li: "" });
  });
});

describe("webhook parsing", () => {
  it("reads the classic shape", () => {
    expect(parseEvent(body)).toEqual({ key: "evt_123", type: "checkout_session.payment.paid", livemode: false, sessionId: "cs_abc", reference: "11111111-1111-4111-8111-111111111111", lineItemsTotal: 59700 });
  });
  it("reads the envelope shape and falls back to a body hash for idempotency", () => {
    const env = JSON.stringify({ event_type: "send.webhook", data: { type: "checkout_session.payment.paid", livemode: true, data: { id: "cs_x", attributes: { reference_number: "r1" } } } });
    const e = parseEvent(env)!;
    expect(e).toMatchObject({ type: "checkout_session.payment.paid", livemode: true, sessionId: "cs_x", reference: "r1", lineItemsTotal: null });
    expect(e.key).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(parseEvent(env)!.key).toBe(e.key);
  });
  it("ignores junk", () => {
    expect(parseEvent("not json")).toBeNull();
    expect(parseEvent(JSON.stringify({ data: { attributes: {} } }))).toBeNull();
    expect(parseEvent(JSON.stringify({ data: { type: "x", data: { attributes: { line_items: [{ amount: "lots" }] } } } }))?.lineItemsTotal).toBeNull();
  });
  it("converts pesos to centavos exactly", () => {
    expect(toCentavos(199)).toBe(19900);
    expect(toCentavos(0.1 + 0.2)).toBe(30);
  });
});

describe("entitlement rules", () => {
  const at = new Date("2026-11-18T00:00:00Z");
  const ent = (plan: "freelancer" | "negosyo", end: string, status: "active" | "canceled" = "active") => ({ plan_key: plan, current_period_end: end, status });
  it("checks plan rank and expiry; cancelation keeps access until the end", () => {
    expect(hasAccess(null, "freelancer", at)).toBe(false);
    expect(hasAccess(ent("freelancer", "2026-12-01T00:00:00Z"), "freelancer", at)).toBe(true);
    expect(hasAccess(ent("freelancer", "2026-12-01T00:00:00Z"), "negosyo", at)).toBe(false);
    expect(hasAccess(ent("negosyo", "2026-12-01T00:00:00Z"), "freelancer", at)).toBe(true);
    expect(hasAccess(ent("negosyo", "2026-11-17T00:00:00Z"), "freelancer", at)).toBe(false);
    expect(hasAccess(ent("freelancer", "2026-12-01T00:00:00Z", "canceled"), "freelancer", at)).toBe(true);
  });
  it("blocks buying a lower plan while a higher one runs", () => {
    expect(checkoutAllowed(ent("negosyo", "2026-12-01T00:00:00Z"), "freelancer", at)).toBe(false);
    expect(checkoutAllowed(ent("freelancer", "2026-12-01T00:00:00Z"), "negosyo", at)).toBe(true);
    expect(checkoutAllowed(ent("negosyo", "2026-11-01T00:00:00Z"), "freelancer", at)).toBe(true);
    expect(daysLeft(ent("freelancer", "2026-11-20T12:00:00Z"), at)).toBe(3);
  });
});

describe("renewal reminders", async () => {
  const { renewalDue } = await import("@/lib/freelancer/reminders");
  const at = new Date("2026-11-18T00:00:00Z");
  it("fires once within 3 days of the end, never after stopping or after the end", () => {
    expect(renewalDue({ current_period_end: "2026-11-20T00:00:00Z", status: "active", renewal_reminded_at: null }, at)).toBe(true);
    expect(renewalDue({ current_period_end: "2026-11-25T00:00:00Z", status: "active", renewal_reminded_at: null }, at)).toBe(false);
    expect(renewalDue({ current_period_end: "2026-11-20T00:00:00Z", status: "canceled", renewal_reminded_at: null }, at)).toBe(false);
    expect(renewalDue({ current_period_end: "2026-11-20T00:00:00Z", status: "active", renewal_reminded_at: "2026-11-17T00:00:00Z" }, at)).toBe(false);
    expect(renewalDue({ current_period_end: "2026-11-17T00:00:00Z", status: "active", renewal_reminded_at: null }, at)).toBe(false);
  });
});
