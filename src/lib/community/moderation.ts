/**
 * Anti-fixer rules for community tips. Every tip still needs an admin's
 * approval before it is public; these rules only auto-REJECT clear fixer
 * patterns (contact details, paid-slot offers) and add flags for the reviewer.
 * A tip that merely WARNS about fixers is flagged, not rejected.
 */
export type TipFlag = "phone_number" | "contact_offer" | "messaging_link" | "money_offer" | "slot_offer" | "mentions_fixer" | "email";

const RULES: [TipFlag, RegExp][] = [
  // Philippine mobile numbers: 09XX XXX XXXX or +63 9XX XXX XXXX, with optional separators.
  ["phone_number", /(?:\+?63|0)\s*9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/],
  ["contact_offer", /\b(pm|dm|message|text|chat|contact|call)\s+(me|us|lang)\b/i],
  ["messaging_link", /(https?:\/\/|www\.)|\b(facebook\.com|fb\.com|m\.me|t\.me|wa\.me|viber|telegram|whatsapp)\b/i],
  ["money_offer", /(₱|\bphp\b|\bpesos?\b)\s*\d|\d\s*(₱|\bphp\b|\bpesos?\b)|\bbayad\b.*\b(lang|only)\b/i],
  ["slot_offer", /\b(slot|slots|rush|assist(ance)?|guaranteed|walang pila|no queue|express lane)\b/i],
  ["mentions_fixer", /\bfixers?\b/i],
  ["email", /[\w.+-]+@[\w-]+\.[\w.]+/],
];

export function moderateTip(text: string): { flags: TipFlag[]; autoReject: boolean } {
  const flags = RULES.filter(([, re]) => re.test(text)).map(([flag]) => flag);
  const has = (f: TipFlag) => flags.includes(f);
  // Contact details or messaging links are never needed in a tip; together with
  // any offer they are the classic fixer pattern.
  const autoReject =
    has("phone_number") || has("email") || has("messaging_link") || has("contact_offer") || (has("slot_offer") && has("money_offer"));
  return { flags, autoReject };
}
