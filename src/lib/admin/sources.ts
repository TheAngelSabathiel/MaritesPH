/** Groups content source URLs by website for the admin Sources page. Pure. */
export type SourceRow = { source_url: string | null; status: string; last_verified_at: string | null };

export type SourceGroup = {
  host: string;
  records: number;
  unverified: number;
  oldestVerifiedAt: string | null;
  urls: { url: string; records: number }[];
};

export function groupSources(rows: SourceRow[]): { groups: SourceGroup[]; missing: number } {
  const groups = new Map<string, SourceGroup>();
  let missing = 0;
  for (const row of rows) {
    if (!row.source_url) {
      missing += 1;
      continue;
    }
    let host: string;
    try {
      host = new URL(row.source_url).hostname.replace(/^www\./, "");
    } catch {
      host = "(invalid URL)";
    }
    const g = groups.get(host) ?? { host, records: 0, unverified: 0, oldestVerifiedAt: null, urls: [] };
    g.records += 1;
    if (!row.last_verified_at) g.unverified += 1;
    else if (!g.oldestVerifiedAt || row.last_verified_at < g.oldestVerifiedAt) g.oldestVerifiedAt = row.last_verified_at;
    const u = g.urls.find((x) => x.url === row.source_url);
    if (u) u.records += 1;
    else g.urls.push({ url: row.source_url, records: 1 });
    groups.set(host, g);
  }
  const sorted = [...groups.values()].sort((a, b) => b.records - a.records || a.host.localeCompare(b.host));
  for (const g of sorted) g.urls.sort((a, b) => b.records - a.records || a.url.localeCompare(b.url));
  return { groups: sorted, missing };
}
