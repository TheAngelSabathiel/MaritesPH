/**
 * AI classification and change proposals for issuances, with strict validation:
 *  - classification may only name records from the candidate list it was given;
 *  - a proposal may only change factual fields of an editable record type, and the
 *    resulting record must still pass the same Zod schema the admin forms use.
 * Nothing here writes to content: it only produces data for the review queue.
 */
import { z } from "zod";
import { factualFields, resourceForTargetType } from "@/lib/admin/resources";
import { schemas } from "@/lib/admin/schemas";
import { changedFields } from "@/lib/admin/workflow";

export type Candidate = { targetType: string; id: string; label: string };

export const classificationSchema = z.object({
  issuanceType: z.enum(["republic_act", "irr", "executive_order", "regulation", "memorandum_circular", "order", "advisory", "news", "other"]),
  issuingBody: z.string().trim().max(200).default(""),
  issuanceNumber: z.string().trim().max(80).nullable().default(null),
  dateIssued: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  topic: z.enum(["ids", "tax", "business", "general"]),
  summary: z.string().trim().min(1).max(1000),
  affected: z.array(z.object({ id: z.string(), relevance: z.number().min(0).max(1), reason: z.string().trim().max(500) })).max(10).default([]),
});
export type Classification = z.infer<typeof classificationSchema>;

/** Keep only affected ids that were in the candidate list. */
export function validateClassification(raw: unknown, candidates: Candidate[]): Classification | null {
  const parsed = classificationSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ids = new Set(candidates.map((c) => c.id));
  return { ...parsed.data, affected: parsed.data.affected.filter((a) => ids.has(a.id)) };
}

/** Cheap pre-filter so the prompt carries a short, relevant candidate list. */
export function rankCandidates(text: string, candidates: Candidate[], limit = 40): Candidate[] {
  const words = new Set(text.toLowerCase().match(/[a-z0-9ñ]{3,}/g) ?? []);
  const score = (c: Candidate) => (c.label.toLowerCase().match(/[a-z0-9ñ]{3,}/g) ?? []).filter((w) => words.has(w)).length;
  return candidates
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c);
}

export const proposalSchema = z.object({
  noChange: z.boolean().default(false),
  fields: z.record(z.string(), z.unknown()).default({}),
  rationale: z.string().trim().max(2000).default(""),
  publicSummary: z.string().trim().max(300).default(""),
});

export type ValidProposal =
  | { kind: "change"; fields: Record<string, { before: unknown; after: unknown }>; rationale: string; publicSummary: string }
  | { kind: "no_change"; rationale: string };

/** Editable fields an AI proposal may touch for a record type (facts only; never the source or notes). */
export function proposableFields(targetType: string): string[] {
  const resource = resourceForTargetType(targetType);
  if (!resource || resource.key === "legal_reference" || resource.key === "office_service") return [];
  return factualFields(resource).filter((f) => f !== "source_url" && f !== "target_type" && f !== "target_id");
}

export function validateProposal(raw: unknown, targetType: string, current: Record<string, unknown>): ValidProposal | null {
  const parsed = proposalSchema.safeParse(raw);
  const resource = resourceForTargetType(targetType);
  if (!parsed.success || !resource) return null;
  if (parsed.data.noChange) return { kind: "no_change", rationale: parsed.data.rationale };

  const allowed = proposableFields(targetType);
  const names = Object.keys(parsed.data.fields);
  if (names.length === 0 || names.some((n) => !allowed.includes(n))) return null;

  // The edited record must still be valid by the same rules as the admin form.
  const merged = { ...current, ...parsed.data.fields };
  if (!schemas[resource.key].safeParse(merged).success) return null;

  const changed = changedFields(current, merged, names);
  if (changed.length === 0) return { kind: "no_change", rationale: parsed.data.rationale };
  return {
    kind: "change",
    fields: Object.fromEntries(changed.map((n) => [n, { before: current[n] ?? null, after: merged[n] ?? null }])),
    rationale: parsed.data.rationale,
    publicSummary: parsed.data.publicSummary,
  };
}
