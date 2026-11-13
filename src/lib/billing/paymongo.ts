/**
 * PayMongo Checkout (server-only), per PayMongo's Hosted Checkout docs:
 * POST https://api.paymongo.com/v2/checkout_sessions with HTTP Basic auth
 * (secret key as username, empty password); amounts in centavos; the response's
 * data.attributes.checkout_url is where the customer pays. Our payment id is
 * sent as reference_number so the webhook can find it.
 */
import "server-only";

export type PaymongoConfig = { secretKey: string; webhookSecret: string; livemode: boolean; methods: string[] };

export function paymongoConfig(): PaymongoConfig | null {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret || !/^sk_(test|live)_/.test(secretKey)) return null;
  const methods = (process.env.PAYMONGO_PAYMENT_METHODS || "gcash,paymaya,card,qrph").split(",").map((m) => m.trim()).filter(Boolean);
  return { secretKey, webhookSecret, livemode: secretKey.startsWith("sk_live_"), methods };
}

export async function createCheckoutSession(
  cfg: PaymongoConfig,
  input: { referenceNumber: string; name: string; description: string; amountCentavos: number; successUrl: string; cancelUrl: string },
): Promise<{ ok: true; sessionId: string; checkoutUrl: string } | { ok: false; status: number }> {
  try {
    const res = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${cfg.secretKey}:`).toString("base64")}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{ name: input.name, amount: input.amountCentavos, currency: "PHP", quantity: 1 }],
            payment_method_types: cfg.methods,
            description: input.description,
            reference_number: input.referenceNumber,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const json = (await res.json()) as { data?: { id?: string; attributes?: { checkout_url?: string } } };
    const sessionId = json.data?.id;
    const checkoutUrl = json.data?.attributes?.checkout_url;
    // Only ever redirect to PayMongo's own hosted page.
    if (!sessionId || !checkoutUrl || !/^https:\/\/([a-z0-9-]+\.)*paymongo\.com\//.test(checkoutUrl)) return { ok: false, status: 502 };
    return { ok: true, sessionId, checkoutUrl };
  } catch {
    return { ok: false, status: 503 };
  }
}
