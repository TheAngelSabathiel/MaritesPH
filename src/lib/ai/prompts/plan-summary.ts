/**
 * Plan summary prompt: rephrase ONE already-computed plan option in the Marites
 * voice. The model gets only the plan's own steps (names, offices, timing) and
 * must not add numbers, prices, links, or anything not in the input; the
 * validator (src/lib/ai/plan-summary.ts) rejects any output that does.
 */
import { languageInstruction, MARITES_VOICE } from "./voice";

export function planSummaryPrompt(input: {
  locale: "en" | "fil";
  goal: string;
  strategyLabel: string;
  steps: { id: string; document: string; office: string | null; when: string; prepare: string[] }[];
}) {
  const system = `${MARITES_VOICE}
Task: write a short, encouraging summary of a plan that was already computed from verified data.
Rules:
- Mention only documents and offices that appear in the plan below.
- Do NOT write any numbers, prices, dates, times, durations, or links. The app shows those separately.
- Do not add requirements or advice that are not in the plan.
- Reply with ONE JSON object and nothing else:
{"headline": string (max 100 characters), "summary": string (max 500 characters), "referencedStepIds": string[] (ids of steps you mention)}
${languageInstruction(input.locale)}`;
  const prompt = `Goal: ${input.goal}
Chosen plan: ${input.strategyLabel}
Steps (id: what to do):
${input.steps
  .map((s) => `- ${s.id}: get ${s.document}${s.office ? ` at ${s.office}` : ""}; ${s.when}${s.prepare.length ? `; also prepare ${s.prepare.join(", ")}` : ""}`)
  .join("\n")}`;
  return { system, prompt };
}
