/** Billing rules shared by server code and tests (pure). */
export type PlanKey = "freelancer" | "negosyo";
export const PLAN_RANK: Record<PlanKey, number> = { freelancer: 1, negosyo: 2 };
export const PERIOD_MONTHS = [1, 3, 6, 12] as const;
export type Entitlement = { plan_key: PlanKey; current_period_end: string; status: "active" | "canceled" };

/** Access to a plan's features: the entitlement must cover that plan (or a higher one) and not have ended. */
export function hasAccess(e: Entitlement | null, needed: PlanKey, now: Date): boolean {
  if (!e) return false;
  return PLAN_RANK[e.plan_key] >= PLAN_RANK[needed] && Date.parse(e.current_period_end) > now.getTime();
}

/** Checkout is refused for a lower plan while a higher one is active (the database would hold it for review). */
export function checkoutAllowed(e: Entitlement | null, plan: PlanKey, now: Date): boolean {
  return !e || Date.parse(e.current_period_end) <= now.getTime() || PLAN_RANK[plan] >= PLAN_RANK[e.plan_key];
}

export function daysLeft(e: Entitlement | null, now: Date): number {
  return e ? Math.max(0, Math.ceil((Date.parse(e.current_period_end) - now.getTime()) / 86_400_000)) : 0;
}
