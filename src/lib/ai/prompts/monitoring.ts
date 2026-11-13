/**
 * Bantay Batas prompts.
 *  - classify: read an official issuance and say what it is, its topic, a plain
 *    summary, and which records FROM THE GIVEN LIST it may affect. No web search:
 *    the model reads only the extracted text we provide.
 *  - propose: for one affected record, draft the field changes the issuance
 *    requires, or say no change is needed. Output is validated against the
 *    record's form schema; an admin reviews every proposal before anything changes.
 */
import { MARITES_VOICE } from "./voice";

const HIERARCHY = `Source hierarchy, strongest first: laws (Republic Acts) and the Constitution; implementing rules and executive orders; agency issuances (circulars, orders, regulations); official advisories; news; community posts. Newer official issuances supersede older ones.`;

export function classifyPrompt(input: { title: string; url: string; text: string; candidates: { id: string; targetType: string; label: string }[] }) {
  const system = `${MARITES_VOICE}
${HIERARCHY}
Task: classify an official Philippine government issuance and find which of the listed records it may affect.
Rules:
- Use only the text provided. Do not guess numbers or dates that are not in the text.
- Only use record ids from the candidate list. Relevance: 1 = directly changes the record, 0.5 = related, 0 = unrelated.
- Reply with ONE JSON object and nothing else:
{"issuanceType": "republic_act"|"irr"|"executive_order"|"regulation"|"memorandum_circular"|"order"|"advisory"|"news"|"other", "issuingBody": string, "issuanceNumber": string|null, "dateIssued": "YYYY-MM-DD"|null, "effectiveDate": "YYYY-MM-DD"|null, "topic": "ids"|"tax"|"business"|"general", "summary": string (plain English, max 600 chars), "affected": [{"id": string, "relevance": number, "reason": string}] (max 6)}`;
  const prompt = `Title: ${input.title}
URL: ${input.url}
Candidate records (id | type | name):
${input.candidates.map((c) => `${c.id} | ${c.targetType} | ${c.label}`).join("\n") || "(none)"}

Issuance text (may be truncated):
${input.text.slice(0, 30_000)}`;
  return { system, prompt };
}

export function proposePrompt(input: { issuanceTitle: string; issuanceSummary: string; text: string; targetType: string; label: string; current: Record<string, unknown>; fields: string[] }) {
  const system = `${MARITES_VOICE}
${HIERARCHY}
Task: decide whether the issuance requires changing the record below, and if so, draft the new values.
Rules:
- Change only these fields: ${input.fields.join(", ")}.
- Use only what the issuance text clearly states. If it doesn't clearly change the record, answer noChange.
- Keep each value's type (numbers stay numbers, text stays text).
- Reply with ONE JSON object and nothing else:
{"noChange": boolean, "fields": {"<field>": <new value>}, "rationale": string (cite the section or sentence, max 800 chars), "publicSummary": string (one plain sentence for the public "Ano'ng Bago?" feed, max 200 chars)}`;
  const prompt = `Issuance: ${input.issuanceTitle}
Summary: ${input.issuanceSummary}

Record: ${input.label} (${input.targetType})
Current values: ${JSON.stringify(Object.fromEntries(input.fields.map((f) => [f, input.current[f] ?? null])))}

Issuance text (may be truncated):
${input.text.slice(0, 20_000)}`;
  return { system, prompt };
}
