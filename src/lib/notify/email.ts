/**
 * Email sending through Resend's HTTP API (no SDK). Server-only.
 * Returns false (and sends nothing) when RESEND_API_KEY / EMAIL_FROM are unset.
 * Never logs message bodies or recipient addresses.
 */
import "server-only";

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error("email send failed", res.status);
    return res.ok;
  } catch {
    console.error("email send failed: network");
    return false;
  }
}
