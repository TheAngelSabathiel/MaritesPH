/**
 * PayMongo webhook. Order of checks:
 *  1. signature over the RAW body (te in test mode, li in live mode), 72 h window;
 *  2. event mode must match this deployment's key (test events can't grant live access);
 *  3. idempotency: the event key is recorded first; a repeat returns 200 and does nothing;
 *  4. checkout_session.payment.paid: find our payment by reference_number (or session id),
 *     check the line-item total equals what we charged, then apply_payment().
 * Responds 2xx for anything verified (so PayMongo stops retrying), 401 for bad signatures.
 * Never logs payloads or personal data.
 */
import { NextResponse, type NextRequest } from "next/server";
import { paymongoConfig } from "@/lib/billing/paymongo";
import { verifySignature } from "@/lib/billing/signature";
import { parseEvent, toCentavos } from "@/lib/billing/webhook";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const cfg = paymongoConfig();
  const db = createSupabaseServiceClient();
  if (!cfg || !db) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  const check = verifySignature({ rawBody: raw, header: request.headers.get("paymongo-signature"), secret: cfg.webhookSecret, livemode: cfg.livemode, nowSeconds: Math.floor(Date.now() / 1000) });
  if (check !== "ok") return NextResponse.json({ error: `signature ${check}` }, { status: 401 });

  const event = parseEvent(raw);
  if (!event) return NextResponse.json({ ok: true, ignored: "unparsed" });
  if (event.livemode != null && event.livemode !== cfg.livemode) return NextResponse.json({ ok: true, ignored: "mode" });

  const { error: dup } = await db.from("webhook_events").insert({ event_key: event.key, type: event.type, outcome: "received" });
  if (dup) return NextResponse.json({ ok: true, duplicate: true }); // already handled (unique key)

  const outcome = await handle(db, event);
  await db.from("webhook_events").update({ outcome }).eq("event_key", event.key);
  return NextResponse.json({ ok: true, outcome });
}

async function handle(db: NonNullable<ReturnType<typeof createSupabaseServiceClient>>, event: NonNullable<ReturnType<typeof parseEvent>>): Promise<string> {
  if (event.type !== "checkout_session.payment.paid") return "ignored_type";
  const isUuid = event.reference && /^[0-9a-f-]{36}$/i.test(event.reference);
  const query = db.from("payments").select("id, amount_php, status, checkout_session_id");
  const { data: payment } = isUuid ? await query.eq("id", event.reference!).maybeSingle() : event.sessionId ? await query.eq("checkout_session_id", event.sessionId).maybeSingle() : { data: null };
  if (!payment) return "payment_not_found";
  if (payment.checkout_session_id && event.sessionId && payment.checkout_session_id !== event.sessionId) return "session_mismatch";
  if (event.lineItemsTotal != null && event.lineItemsTotal !== toCentavos(Number(payment.amount_php))) {
    await db.from("payments").update({ status: "review", note: "Paid amount differs from the price charged" }).eq("id", payment.id).eq("status", "pending");
    return "amount_mismatch";
  }
  const { data, error } = await db.rpc("apply_payment", { p_payment_id: payment.id, p_status: "paid" });
  return error ? "apply_failed" : String(data);
}
