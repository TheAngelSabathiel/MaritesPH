/**
 * Requirement grouping. Rows follow "AND of groups, OR of options, AND of items":
 *   - every group is required;
 *   - within a group, any ONE option is enough;
 *   - an option needs ALL of its items.
 * This shapes rows for display (admin now, public guides in Phase 3) and for
 * the dependency engine (Phase 4). Pure; no database access.
 */
export type RequirementRow = {
  id: string;
  group_key: string;
  option_key: string;
  sort_order: number;
  requires_document_id: string | null;
  requirement_text: string | null;
};

export type RequirementOption<R extends RequirementRow = RequirementRow> = { optionKey: string; items: R[] };
export type RequirementGroup<R extends RequirementRow = RequirementRow> = {
  groupKey: string;
  options: RequirementOption<R>[];
};

export function groupRequirements<R extends RequirementRow>(rows: R[]): RequirementGroup<R>[] {
  const sorted = [...rows].sort(
    (a, b) => a.sort_order - b.sort_order || a.group_key.localeCompare(b.group_key) || a.option_key.localeCompare(b.option_key),
  );
  const groups = new Map<string, Map<string, R[]>>();
  for (const row of sorted) {
    const options = groups.get(row.group_key) ?? new Map<string, R[]>();
    const items = options.get(row.option_key) ?? [];
    items.push(row);
    options.set(row.option_key, items);
    groups.set(row.group_key, options);
  }
  return [...groups.entries()].map(([groupKey, options]) => ({
    groupKey,
    options: [...options.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([optionKey, items]) => ({ optionKey, items })),
  }));
}

/** Does a set of documents the user has (plus satisfied free-text ids) meet all groups? */
export function satisfiesRequirements(
  groups: RequirementGroup[],
  isSatisfied: (item: RequirementRow) => boolean,
): { ok: boolean; missingGroups: string[] } {
  const missingGroups = groups
    .filter((g) => !g.options.some((o) => o.items.every(isSatisfied)))
    .map((g) => g.groupKey);
  return { ok: missingGroups.length === 0, missingGroups };
}

/** "valid_id" -> "Valid id" for display when no label is stored. */
export function humanizeKey(key: string): string {
  const text = key.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
