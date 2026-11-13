#!/usr/bin/env node
/**
 * Pre-launch configuration check. Run against production settings, e.g.:
 *   vercel env pull .env.production.local && node --env-file=.env.production.local scripts/launch-check.mjs
 * Prints which settings are present and well-formed; never prints values.
 */
const e = process.env;
const checks = [
  ["NEXT_PUBLIC_SITE_URL is https", /^https:\/\//.test(e.NEXT_PUBLIC_SITE_URL ?? ""), true],
  ["NEXT_PUBLIC_SUPABASE_URL", /^https:\/\/.+/.test(e.NEXT_PUBLIC_SUPABASE_URL ?? ""), true],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", (e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").length > 20, true],
  ["SUPABASE_SECRET_KEY (account deletion, monitoring, payments)", (e.SUPABASE_SECRET_KEY ?? "").length > 20, true],
  ["RATE_LIMIT_SALT (16+ chars)", (e.RATE_LIMIT_SALT ?? "").length >= 16, true],
  ["CRON_SECRET (16+ chars)", (e.CRON_SECRET ?? "").length >= 16, true],
  ["FIELD_ENCRYPTION_KEY (32 bytes, base64)", Buffer.from(e.FIELD_ENCRYPTION_KEY ?? "", "base64").length === 32, true],
  ["CONTACT_EMAIL", /@/.test(e.NEXT_PUBLIC_CONTACT_EMAIL ?? e.CONTACT_EMAIL ?? ""), true],
  ["RESEND_API_KEY + EMAIL_FROM (reminders, alerts)", Boolean(e.RESEND_API_KEY && e.EMAIL_FROM), false],
  ["PAYMONGO_SECRET_KEY is LIVE", (e.PAYMONGO_SECRET_KEY ?? "").startsWith("sk_live_"), false],
  ["PAYMONGO_WEBHOOK_SECRET", (e.PAYMONGO_WEBHOOK_SECRET ?? "").startsWith("whsk_"), false],
  ["CRAWLER_CONTACT_EMAIL", /@/.test(e.CRAWLER_CONTACT_EMAIL ?? ""), false],
  ["AI fully configured (key, model, budget, prices)", Boolean(e.ANTHROPIC_API_KEY && e.ANTHROPIC_MODEL && e.AI_MONTHLY_BUDGET_USD && e.AI_INPUT_USD_PER_MTOK && e.AI_OUTPUT_USD_PER_MTOK && e.AI_WEB_SEARCH_USD_PER_1K), false],
  ["ENABLE_REDDIT_API is off", (e.ENABLE_REDDIT_API ?? "false") === "false", true],
  ["ENABLE_UI_PREVIEW is off", (e.ENABLE_UI_PREVIEW ?? "false") !== "true", true],
];
let failed = 0;
for (const [label, ok, required] of checks) {
  console.log(`${ok ? "✔" : required ? "✘" : "–"} ${label}${ok ? "" : required ? "  (REQUIRED)" : "  (optional: feature stays off)"}`);
  if (!ok && required) failed++;
}
console.log(failed ? `\n${failed} required setting(s) missing or malformed.` : "\nRequired settings look good. Also run the README launch checklist.");
process.exit(failed ? 1 : 0);
