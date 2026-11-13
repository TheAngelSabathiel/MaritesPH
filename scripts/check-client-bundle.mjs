#!/usr/bin/env node
/**
 * After `next build`: fails if anything secret appears in the browser bundle
 * (.next/static). Checks secret variable NAMES, known secret key PREFIXES, and
 * the actual VALUES of secret variables from the environment / .env.local.
 *   npm run check:bundle
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SECRET_VARS = ["SUPABASE_SECRET_KEY", "ANTHROPIC_API_KEY", "PAYMONGO_SECRET_KEY", "PAYMONGO_WEBHOOK_SECRET", "RESEND_API_KEY", "FIELD_ENCRYPTION_KEY", "CRON_SECRET", "RATE_LIMIT_SALT"];
const PREFIXES = ["sb_secret_", "sk_test_", "sk_live_", "whsk_", "sk-ant-", "re_"];

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !(m[1] in env)) env[m[1]] = m[2];
  }
}
const values = SECRET_VARS.map((k) => env[k]).filter((v) => v && v.length >= 8);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith(".js")) yield p;
  }
}

if (!existsSync(".next/static")) {
  console.error("No .next/static: run `npm run build` first.");
  process.exit(2);
}
const problems = [];
let files = 0;
for (const file of walk(".next/static")) {
  files++;
  const text = readFileSync(file, "utf8");
  for (const name of SECRET_VARS) if (text.includes(name)) problems.push(`${file}: mentions ${name}`);
  for (const v of values) if (text.includes(v)) problems.push(`${file}: contains the VALUE of a secret variable`);
  // Prefixes need a key-like tail to avoid false positives on ordinary words.
  for (const pre of PREFIXES) if (new RegExp(`["'\`]${pre.replace(/[-_]/g, "\\$&")}[A-Za-z0-9_-]{12,}`).test(text)) problems.push(`${file}: looks like a ${pre}… key`);
}
if (problems.length) {
  console.error(`Secrets found in the browser bundle:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`Client bundle clean: ${files} files checked, ${values.length} secret values compared.`);
