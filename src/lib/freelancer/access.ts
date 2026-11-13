/**
 * Who can use Marites Freelancer tools: users whose entitlement covers the
 * Freelancer plan (Negosyo includes it). Decided only by entitlements
 * (src/lib/billing/access.ts). Signed-out → "signin"; no plan → "upgrade".
 */
import "server-only";
import { requirePlan, type PlanAccess } from "@/lib/billing/access";

export async function freelancerAccess(): Promise<PlanAccess> {
  return requirePlan("freelancer");
}
