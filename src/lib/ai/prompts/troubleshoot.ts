/**
 * Chika sa Pila prompt: search community discussions (web search limited to
 * COMMUNITY_SEARCH_DOMAINS, default reddit.com) for people who had the same
 * problem, and summarize causes and what resolved it. Paraphrase only: no
 * quotes, no usernames, no personal details. Every resolution cites the URLs
 * it came from; uncited or invented links are removed by the engine.
 */
import { languageInstruction, MARITES_VOICE } from "./voice";

export function troubleshootPrompt(input: { locale: "en" | "fil"; documentName: string; agencyName: string | null; problem: string }) {
  const system = `${MARITES_VOICE}
Task: search community discussions for people who had the problem below, and summarize what they reported.
Rules:
- Use web search. Only use results you actually found; cite their exact URLs.
- Paraphrase in your own words. No quotes, usernames, or personal details.
- These are community experiences, not official rules. Say which official channel resolved it when people mention one.
- Prefer recent reports and say how recent they are.
- If you find nothing relevant, return an empty resolutions list.
- Reply with ONE JSON object and nothing else:
{"summary": string (max 400 chars), "causes": string[] (max 4), "resolutions": [{"text": string (max 250 chars), "officialChannel": string|null, "sources": [{"url": string}]}] (max 4), "confidence": "low"|"medium"|"high", "recency": string (max 80 chars), "officialGuidance": string (max 250 chars, which agency channel to contact)}
${languageInstruction(input.locale)}`;
  const prompt = `Document: ${input.documentName}${input.agencyName ? ` (issued by ${input.agencyName})` : ""}
Problem described by the user: ${input.problem}`;
  return { system, prompt };
}
