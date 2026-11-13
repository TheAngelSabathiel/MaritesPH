/** Display formatting for public pages. Pure. */

/** ₱1,200 or ₱1,200.50 (Philippine peso, Philippine conventions). */
export function formatPeso(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Fee display: null when unknown, "free" marker when zero, single value or range. */
export function feeDisplay(min: number | null, max: number | null): { kind: "unknown" } | { kind: "free" } | { kind: "amount"; text: string } | { kind: "range"; min: string; max: string } {
  if (min == null && max == null) return { kind: "unknown" };
  const lo = min ?? max!;
  const hi = max ?? min!;
  if (lo === 0 && hi === 0) return { kind: "free" };
  if (lo === hi) return { kind: "amount", text: formatPeso(lo) };
  return { kind: "range", min: formatPeso(lo), max: formatPeso(hi) };
}
