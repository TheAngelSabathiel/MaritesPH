#!/usr/bin/env node
/**
 * Sends a signed checkout_session.payment.paid webhook to a running server,
 * signed exactly like PayMongo (HMAC-SHA256 of "<t>.<raw body>" with the
 * webhook secret, in the te= slot for test mode). For local checks and for
 * test-mode rehearsals before going live. Never use it against production with
 * a live secret.
 *
 *   PAYMONGO_WEBHOOK_SECRET=whsk_... node scripts/paymongo-webhook-smoke.mjs \
 *     --url http://localhost:3100/api/webhooks/paymongo --payment <payments.id> --amount 19900 [--event evt_x] [--tamper]
 */
import { createHmac, randomUUID } from "node:crypto";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? "true" : all[i + 1]]] : acc), []));
const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
if (!secret || !args.url || !args.payment) {
  console.error("Usage: PAYMONGO_WEBHOOK_SECRET=... node scripts/paymongo-webhook-smoke.mjs --url <webhook url> --payment <payment id> --amount <centavos> [--event evt_id] [--tamper]");
  process.exit(2);
}
const body = JSON.stringify({
  data: {
    id: args.event ?? `evt_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    type: "event",
    attributes: {
      type: "checkout_session.payment.paid",
      livemode: false,
      data: { id: args.session ?? `cs_smoke_${Date.now()}`, type: "checkout_session", attributes: { reference_number: args.payment, line_items: [{ name: "Smoke test", amount: Number(args.amount ?? 0), currency: "PHP", quantity: 1 }] } },
    },
  },
});
const t = Math.floor(Date.now() / 1000);
const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
const sent = args.tamper === "true" ? body.replace('"amount":', '"amount":1') : body;
const res = await fetch(args.url, { method: "POST", headers: { "content-type": "application/json", "paymongo-signature": `t=${t},te=${sig},li=` }, body: sent });
console.log(res.status, await res.text());
