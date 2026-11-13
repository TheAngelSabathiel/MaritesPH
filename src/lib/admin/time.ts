/** Time helpers for admin pages (kept out of component bodies for render purity). */
export function staleCutoffIso(staleDays: number, now: Date = new Date()): string {
  return new Date(now.getTime() - staleDays * 86_400_000).toISOString();
}
