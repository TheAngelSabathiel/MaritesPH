/**
 * Entitlement lookup (server-only). Paid feature access is decided ONLY here,
 * from the entitlements table (rules in ./rules.ts).
 */
import "server-only";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { hasAccess, type Entitlement, type PlanKey } from "./rules";

export async function myEntitlement(userId: string): Promise<Entitlement | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("entitlements").select("plan_key, current_period_end, status").eq("user_id", userId).maybeSingle();
  return (data as Entitlement | null) ?? null;
}

export type PlanAccess = { status: "ok"; userId: string; email: string | null; entitlement: Entitlement } | { status: "signin" } | { status: "upgrade"; userId: string };

export async function requirePlan(needed: PlanKey): Promise<PlanAccess> {
  const user = await getCurrentUserClaims();
  if (!user) return { status: "signin" };
  const e = await myEntitlement(user.id);
  return e && hasAccess(e, needed, new Date()) ? { status: "ok", userId: user.id, email: user.email, entitlement: e } : { status: "upgrade", userId: user.id };
}
