/**
 * Live context prompts (run when a guide's cache has expired):
 *  - official: search government domains (OFFICIAL_SEARCH_DOMAINS, default
 *    gov.ph) for issuances or advisories NEWER than the guide's last
 *    verification that may change it, and say whether each may CONFLICT with
 *    the verified summary we provide. Source hierarchy is stated in the prompt.
 *  - community: search community domains for recent experiences. Never used
 *    to change requirements; shown separately and labeled unverified.
 */
import { languageInstruction, MARITES_VOICE } from "./voice";

const HIERARCHY = `Source hierarchy, strongest first: laws (Republic Acts) and the Constitution; implementing rules and executive orders; agency issuances (circulars, orders, regulations); official advisories; news; community posts. Newer official issuances supersede older ones.`;

export function officialContextPrompt(input: { locale: "en" | "fil"; documentName: string; agencyName: string | null; lastVerified: string; verifiedSummary: string }) {
  const system = `${MARITES_VOICE}
${HIERARCHY}
Task: find official government updates published AFTER ${input.lastVerified} that may affect how to get the document below.
Rules:
- Use web search. Only report pages you actually found; cite their exact URLs.
- Only official government sources. Ignore anything older than ${input.lastVerified}.
- Set "conflicts" to true only if the update may contradict the verified summary (for example a new fee or a changed requirement).
- If nothing new is found, return an empty list.
- Reply with ONE JSON object and nothing else:
{"items": [{"title": string, "issuingBody": string, "issuanceNumber": string|null, "date": string|null (YYYY-MM-DD), "url": string, "summary": string (max 250 chars), "conflicts": boolean, "conflictNote": string|null (max 200 chars)}] (max 4)}
${languageInstruction(input.locale)}`;
  const prompt = `Document: ${input.documentName}${input.agencyName ? ` (${input.agencyName})` : ""}
Verified summary (last checked ${input.lastVerified}):
${input.verifiedSummary}`;
  return { system, prompt };
}

export function communityContextPrompt(input: { locale: "en" | "fil"; documentName: string; agencyName: string | null }) {
  const system = `${MARITES_VOICE}
Task: find recent community discussions about getting the document below: problems people hit, queues, extra requirements they were asked for.
Rules:
- Use web search. Only report pages you actually found; cite their exact URLs.
- Paraphrase. No quotes, usernames, or personal details.
- These are experiences, not rules.
- Reply with ONE JSON object and nothing else:
{"items": [{"url": string, "date": string|null (YYYY-MM-DD), "summary": string (max 200 chars)}] (max 4)}
${languageInstruction(input.locale)}`;
  return { system, prompt: `Document: ${input.documentName}${input.agencyName ? ` (${input.agencyName})` : ""}` };
}
