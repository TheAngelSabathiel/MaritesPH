/** Taxable year from ?year=, defaulting to the current year in Manila. Pure. */
export function pickYear(raw: string | string[] | undefined, now: Date): number {
  const current = new Date(now.getTime() + 8 * 3_600_000).getUTCFullYear();
  const y = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(y) && y >= 2018 && y <= current + 1 ? y : current;
}
