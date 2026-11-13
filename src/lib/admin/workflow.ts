/**
 * Verification workflow: draft -> verified -> published (-> archived).
 * Pure functions (callers pass `now` and the acting admin), fully unit-tested.
 * The database enforces the same guardrails as a backstop; these rules give
 * admins clear messages before the database would reject a change.
 *
 * Key rule: editing a FACT on a verified or published record sends it back
 * to draft, unless the admin confirms they re-checked the source just now.
 * That stops an unverified edit from going straight to the public site.
 */

export const STATUSES = ["draft", "verified", "published", "archived"] as const;
export type ContentStatus = (typeof STATUSES)[number];

export type VerificationState = {
  status: ContentStatus;
  source_url: string | null;
  last_verified_at: string | null;
  to_verify_note: string | null;
  /** Only tax rules/deadlines carry this; undefined elsewhere. */
  cpa_reviewed?: boolean | null;
};

export type WorkflowPatch = {
  status?: ContentStatus;
  last_verified_at?: string;
  verified_by?: string;
};

export type WorkflowResult = { ok: true; patch: WorkflowPatch; notice?: string } | { ok: false; reason: string };

const TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ["verified", "archived"],
  verified: ["published", "draft", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
};

export function allowedTransitions(status: ContentStatus): ContentStatus[] {
  return TRANSITIONS[status];
}

/** Human labels for transition buttons. */
export function transitionLabel(from: ContentStatus, to: ContentStatus): string {
  if (to === "verified") return "Mark verified";
  if (to === "published") return "Publish";
  if (to === "archived") return "Archive";
  if (from === "published") return "Unpublish (back to draft)";
  if (from === "archived") return "Restore to draft";
  return "Back to draft";
}

function verificationProblems(record: VerificationState): string[] {
  const problems: string[] = [];
  if (!record.source_url) problems.push("add an official source URL");
  if (record.to_verify_note?.trim()) problems.push("resolve and clear the TO VERIFY note");
  return problems;
}

export function checkTransition(
  record: VerificationState,
  to: ContentStatus,
  ctx: { now: Date; actorId: string; requiresCpaReview?: boolean },
): WorkflowResult {
  if (!allowedTransitions(record.status).includes(to)) {
    return { ok: false, reason: `Can't go from ${record.status} to ${to}.` };
  }

  if (to === "verified") {
    const problems = verificationProblems(record);
    if (problems.length) return { ok: false, reason: `Before marking verified: ${problems.join("; ")}.` };
    return {
      ok: true,
      patch: { status: "verified", last_verified_at: ctx.now.toISOString(), verified_by: ctx.actorId },
    };
  }

  if (to === "published") {
    const problems = verificationProblems(record);
    if (!record.last_verified_at) problems.push("mark it verified first");
    if (ctx.requiresCpaReview && !record.cpa_reviewed) problems.push("get CPA review");
    if (problems.length) return { ok: false, reason: `Before publishing: ${problems.join("; ")}.` };
    return { ok: true, patch: { status: "published" } };
  }

  return { ok: true, patch: { status: to } };
}

/**
 * Decide what an edit does to verification status.
 * @param changedFactualFields names of fact-bearing fields whose value changed
 * @param reverified admin ticked "I re-checked this against the source just now"
 */
export function applyEdit(
  before: VerificationState,
  after: Pick<VerificationState, "source_url" | "to_verify_note">,
  changedFactualFields: string[],
  reverified: boolean,
  ctx: { now: Date; actorId: string },
): WorkflowResult {
  const live = before.status === "verified" || before.status === "published";
  if (!live) return { ok: true, patch: {} };

  const hasNote = Boolean(after.to_verify_note?.trim());
  if (hasNote) {
    return {
      ok: true,
      patch: { status: "draft" },
      notice: "Moved back to draft because it now has a TO VERIFY note.",
    };
  }

  if (changedFactualFields.length === 0) return { ok: true, patch: {} };

  if (reverified && after.source_url) {
    return {
      ok: true,
      patch: { last_verified_at: ctx.now.toISOString(), verified_by: ctx.actorId },
      notice: "Saved and re-verified.",
    };
  }

  return {
    ok: true,
    patch: { status: "draft" },
    notice: `Moved back to draft because these facts changed without re-verification: ${changedFactualFields.join(", ")}.`,
  };
}

/** Stale queue action: confirm a record is still correct as of now. */
export function checkReverify(record: VerificationState, ctx: { now: Date; actorId: string }): WorkflowResult {
  if (record.status !== "verified" && record.status !== "published") {
    return { ok: false, reason: "Only verified or published records can be re-verified." };
  }
  const problems = verificationProblems(record);
  if (problems.length) return { ok: false, reason: `Before re-verifying: ${problems.join("; ")}.` };
  return { ok: true, patch: { last_verified_at: ctx.now.toISOString(), verified_by: ctx.actorId } };
}

/** Hard delete is allowed only for drafts that were never verified. Otherwise archive. */
export function canDelete(record: VerificationState): boolean {
  return record.status === "draft" && !record.last_verified_at;
}

/** JSON with object keys sorted, so {a,b} and {b,a} compare equal. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Field-level change detection. Treats null, undefined and "" as equal,
 * numeric strings from the database as numbers ("950.00" == 950), and
 * ignores object key order.
 */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): string[] {
  const norm = (v: unknown): string | null => {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) return String(Number(v));
    if (typeof v === "number") return String(v);
    return stableStringify(v);
  };
  return fields.filter((f) => norm(before[f]) !== norm(after[f]));
}
