/**
 * Dependency engine: which documents does someone need to get, in what order,
 * to reach a goal (a specific document, or a purpose such as "bank_account")?
 *
 * Requirement logic (same as the database): every group is required; within a
 * group ANY one option is enough; an option needs ALL its items. Items are
 * either another document (recursion) or free text (something to prepare).
 *
 * "Need an ID to get an ID" loops are handled by refusing any option that
 * would require a document already being worked out higher up the chain; if
 * every option of a group is refused, that path is blocked.
 *
 * Paths are ranked by: in-person visits, documents to get, maximum cost,
 * maximum processing days (in that order). Output is structured data only.
 *
 * Assumptions (README "Engines"):
 *  - A document with at least one in-person step needs ONE visit; a document
 *    whose published steps are all online needs none; no published steps -> 1.
 *  - Unknown fees count as 0 and set costUnknown; unknown processing time
 *    counts as 0 days and sets daysUnknown.
 *  - Processing time is the critical path: a document can't start until all
 *    the documents it needs are done; independent documents run in parallel.
 */
import type { Catalog, CatalogDocument, Goal } from "./types";

export const DEPENDENCY_LIMITS = {
  /** Paths kept per document while searching (keeps the search small). */
  beamWidth: 6,
  /** Paths returned. */
  maxPaths: 4,
  /** Recursion depth guard. */
  maxDepth: 8,
} as const;

export type PrepareItem = { documentId: string; requirementId: string; text: string; quantity: number };

type SubPlan = {
  /** Documents to obtain, in an order where prerequisites come first. */
  acquire: string[];
  /** For each document to obtain: the documents it needs that are also being obtained. */
  prereqs: Record<string, string[]>;
  prepare: PrepareItem[];
};

export type Path = {
  key: string;
  /** The document that satisfies the goal. */
  target: string;
  acquire: string[];
  prereqs: Record<string, string[]>;
  prepare: PrepareItem[];
  cost: { min: number; max: number };
  costUnknown: boolean;
  days: { min: number; max: number };
  daysUnknown: boolean;
  visits: number;
  documentsToGet: number;
};

export type DependencyResult =
  | { status: "already_satisfied"; satisfiedBy: string[] }
  | { status: "paths"; paths: Path[] }
  | { status: "blocked"; reason: "no_candidates" | "unreachable"; candidates: string[] };

const EMPTY: SubPlan = { acquire: [], prereqs: {}, prepare: [] };

function merge(a: SubPlan, b: SubPlan): SubPlan {
  const acquire = [...a.acquire];
  for (const d of b.acquire) if (!acquire.includes(d)) acquire.push(d);
  const prereqs: Record<string, string[]> = { ...a.prereqs };
  for (const [k, v] of Object.entries(b.prereqs)) prereqs[k] = [...new Set([...(prereqs[k] ?? []), ...v])];
  const seen = new Set(a.prepare.map((p) => p.requirementId));
  return { acquire, prereqs, prepare: [...a.prepare, ...b.prepare.filter((p) => !seen.has(p.requirementId))] };
}

/** Every combination of one plan from each list, pruned to the best `width`. */
function product(lists: SubPlan[][], width: number, rank: (p: SubPlan) => number[]): SubPlan[] {
  let acc: SubPlan[] = [EMPTY];
  for (const list of lists) {
    const next: SubPlan[] = [];
    for (const a of acc) for (const b of list) next.push(merge(a, b));
    acc = prune(next, width, rank);
  }
  return acc;
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function prune(plans: SubPlan[], width: number, rank: (p: SubPlan) => number[]): SubPlan[] {
  const unique = new Map<string, SubPlan>();
  for (const p of plans) {
    const key = [...p.acquire].sort().join(",") + "|" + p.prepare.map((x) => x.requirementId).sort().join(",");
    if (!unique.has(key)) unique.set(key, p);
  }
  return [...unique.values()].sort((a, b) => compare(rank(a), rank(b))).slice(0, width);
}

export function visitsFor(doc: CatalogDocument): number {
  if (doc.steps.length === 0) return 1;
  return doc.steps.some((s) => !s.isOnline) ? 1 : 0;
}

export function evaluate(plan: SubPlan, docs: Map<string, CatalogDocument>, target: string): Path {
  let costMin = 0;
  let costMax = 0;
  let costUnknown = false;
  let daysUnknown = false;
  let visits = 0;
  const finishMin: Record<string, number> = {};
  const finishMax: Record<string, number> = {};
  for (const id of plan.acquire) {
    const d = docs.get(id)!;
    if (d.feeMin == null && d.feeMax == null) costUnknown = true;
    costMin += d.feeMin ?? d.feeMax ?? 0;
    costMax += d.feeMax ?? d.feeMin ?? 0;
    if (d.processingDaysMax == null && d.processingDaysMin == null) daysUnknown = true;
    const before = plan.prereqs[id] ?? [];
    finishMin[id] = Math.max(0, ...before.map((p) => finishMin[p] ?? 0)) + (d.processingDaysMin ?? d.processingDaysMax ?? 0);
    finishMax[id] = Math.max(0, ...before.map((p) => finishMax[p] ?? 0)) + (d.processingDaysMax ?? d.processingDaysMin ?? 0);
    visits += visitsFor(d);
  }
  return {
    key: [...plan.acquire].sort().join("+") || "none",
    target,
    acquire: plan.acquire,
    prereqs: plan.prereqs,
    prepare: plan.prepare,
    cost: { min: costMin, max: costMax },
    costUnknown,
    days: { min: Math.max(0, ...Object.values(finishMin)), max: Math.max(0, ...Object.values(finishMax)) },
    daysUnknown,
    visits,
    documentsToGet: plan.acquire.length,
  };
}

export function findPaths(catalog: Catalog, goal: Goal, have: ReadonlySet<string>): DependencyResult {
  const docs = new Map(catalog.documents.map((d) => [d.id, d]));
  const rank = (p: SubPlan): number[] => {
    const e = evaluate(p, docs, "");
    return [e.visits, e.documentsToGet, e.cost.max, e.days.max];
  };

  const memo = new Map<string, SubPlan[]>();
  function plansFor(docId: string, stack: string[]): SubPlan[] {
    if (have.has(docId)) return [EMPTY];
    if (stack.includes(docId) || stack.length >= DEPENDENCY_LIMITS.maxDepth) return []; // loop or too deep
    const doc = docs.get(docId);
    if (!doc) return []; // unpublished or unknown document: can't plan through it
    const memoKey = `${docId}|${stack.join(">")}`;
    const cached = memo.get(memoKey);
    if (cached) return cached;

    const groups = new Map<string, Map<string, typeof doc.requirements>>();
    for (const item of doc.requirements) {
      const options = groups.get(item.groupKey) ?? new Map();
      options.set(item.optionKey, [...(options.get(item.optionKey) ?? []), item]);
      groups.set(item.groupKey, options);
    }

    const groupPlans: SubPlan[][] = [];
    for (const options of groups.values()) {
      const choices: SubPlan[] = [];
      for (const items of options.values()) {
        const perItem: SubPlan[][] = items.map((item) =>
          item.documentId
            ? plansFor(item.documentId, [...stack, docId])
            : [{ ...EMPTY, prepare: [{ documentId: docId, requirementId: item.id, text: item.text ?? "", quantity: item.quantity }] }],
        );
        if (perItem.some((list) => list.length === 0)) continue; // this option is blocked
        const direct = items.map((i) => i.documentId).filter((d): d is string => Boolean(d) && !have.has(d!));
        for (const combo of product(perItem, DEPENDENCY_LIMITS.beamWidth, rank)) {
          choices.push({ ...combo, prereqs: { ...combo.prereqs, __direct__: direct } });
        }
      }
      if (choices.length === 0) {
        memo.set(memoKey, []);
        return []; // a required group can't be satisfied
      }
      groupPlans.push(prune(choices, DEPENDENCY_LIMITS.beamWidth, rank));
    }

    const result = product(groupPlans, DEPENDENCY_LIMITS.beamWidth, rank).map((p) => {
      const { __direct__: direct = [], ...prereqs } = p.prereqs;
      return {
        acquire: [...p.acquire.filter((d) => d !== docId), docId],
        prereqs: { ...prereqs, [docId]: direct.filter((d) => p.acquire.includes(d)) },
        prepare: p.prepare,
      };
    });
    memo.set(memoKey, result);
    return result;
  }

  // Note: __direct__ collects the documents chosen at THIS level only, because
  // child plans strip theirs before returning.
  const candidates =
    goal.kind === "document"
      ? [goal.documentId]
      : catalog.documents.filter((d) => d.purposes.includes(goal.purpose)).map((d) => d.id);
  if (candidates.length === 0) return { status: "blocked", reason: "no_candidates", candidates };

  const satisfiedBy = candidates.filter((c) => have.has(c));
  if (satisfiedBy.length) return { status: "already_satisfied", satisfiedBy };

  const paths: Path[] = [];
  for (const c of candidates) for (const p of plansFor(c, [])) paths.push(evaluate(p, docs, c));
  if (paths.length === 0) return { status: "blocked", reason: "unreachable", candidates };

  const unique = [...new Map(paths.map((p) => [p.key + "|" + p.prepare.map((x) => x.requirementId).sort().join(","), p])).values()];
  unique.sort((a, b) => compare([a.visits, a.documentsToGet, a.cost.max, a.days.max], [b.visits, b.documentsToGet, b.cost.max, b.days.max]));
  return { status: "paths", paths: unique.slice(0, DEPENDENCY_LIMITS.maxPaths) };
}
