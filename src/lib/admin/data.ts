/**
 * Admin data access. Every query uses the signed-in admin's own session, so
 * Row Level Security is the final gate even if a page check were missed.
 */
import "server-only";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { resources, type ResourceDef, type ResourceKey } from "./resources";

export type Row = Record<string, unknown>;
export type AdminContext = { supabase: SupabaseClient; userId: string };

/** For Server Components: sends visitors to sign-in and hides the panel from non-admins (404). */
export async function requireAdmin(locale: string): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (ctx === "signed-out") redirect(`/${locale}/login`);
  if (ctx === "forbidden") notFound();
  return ctx;
}

/** For Server Actions: no redirects, the caller decides. */
export async function getAdminContext(): Promise<AdminContext | "signed-out" | "forbidden"> {
  const user = await getCurrentUserClaims();
  if (!user) return "signed-out";
  const supabase = await createSupabaseServerClient();
  if (!supabase) return "forbidden";
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") return "forbidden";
  return { supabase, userId: user.id };
}

export async function listRecords(
  supabase: SupabaseClient,
  resource: ResourceDef,
  filter: { status?: string; parentId?: string } = {},
): Promise<Row[]> {
  let query = supabase.from(resource.table).select("*");
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.parentId && resource.parent) query = query.eq(resource.parent.column, filter.parentId);
  for (const order of resource.orderBy) query = query.order(order.column, { ascending: order.ascending, nullsFirst: false });
  const { data, error } = await query.limit(500);
  if (error) throw new Error(`Could not load ${resource.plural}: ${error.code}`);
  return (data ?? []) as Row[];
}

export async function getRecord(supabase: SupabaseClient, resource: ResourceDef, id: string): Promise<Row | null> {
  const { data } = await supabase.from(resource.table).select("*").eq("id", id).maybeSingle();
  return (data as Row | null) ?? null;
}

export async function listLegalReferences(supabase: SupabaseClient, targetIds: string[]): Promise<Row[]> {
  if (targetIds.length === 0) return [];
  const { data } = await supabase
    .from("legal_references")
    .select("*")
    .in("target_id", targetIds)
    .order("source_rank", { ascending: true });
  return (data ?? []) as Row[];
}

export type Option = { value: string; label: string };

/** Options for "reference" fields (agencies, documents). */
export async function referenceOptions(supabase: SupabaseClient, key: ResourceKey): Promise<Option[]> {
  const resource = resources[key];
  // Column list is built at runtime, so widen it to string for the typed select parser.
  const columns: string = `id, ${resource.labelColumn}, status`;
  const { data } = await supabase
    .from(resource.table)
    .select(columns)
    .order(resource.labelColumn, { ascending: true })
    .limit(1000);
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    value: String(r.id),
    label: `${String(r[resource.labelColumn])}${r.status === "published" ? "" : ` (${String(r.status)})`}`,
  }));
}

/**
 * What a legal reference can point at, given the page it is added from:
 * a document and its requirements/steps/purposes, an office and its services,
 * or an agency.
 */
export async function targetOptions(supabase: SupabaseClient, parentType: string, parentId: string): Promise<Option[]> {
  const { data } = await supabase
    .from("content_index")
    .select("target_type, id, label")
    .eq("parent_type", parentType)
    .eq("parent_id", parentId)
    .neq("target_type", "legal_reference");
  const typeLabel: Record<string, string> = {
    agency: "Agency",
    document: "Document",
    document_requirement: "Requirement",
    accepted_for: "Accepted for",
    guide_step: "Step",
    office: "Office",
    office_service: "Service",
  };
  // The parent record itself first, then its children alphabetically.
  return ((data ?? []) as Row[])
    .map((r) => ({
      isParent: String(r.id) === parentId,
      value: `${String(r.target_type)}:${String(r.id)}`,
      label: `${typeLabel[String(r.target_type)] ?? String(r.target_type)}: ${String(r.label)}`,
    }))
    .sort((a, b) => Number(b.isParent) - Number(a.isParent) || a.label.localeCompare(b.label))
    .map(({ value, label }) => ({ value, label }));
}

/** Which admin page edits a content_index row (resolves child rows to their parent). */
export async function parentOf(
  supabase: SupabaseClient,
  targetType: string,
  id: string,
): Promise<{ parentType: string; parentId: string } | null> {
  const { data } = await supabase
    .from("content_index")
    .select("parent_type, parent_id")
    .eq("target_type", targetType)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { parentType: String(data.parent_type), parentId: String(data.parent_id) };
}

export async function auditTrail(supabase: SupabaseClient, targetIds: string[]): Promise<Row[]> {
  if (targetIds.length === 0) return [];
  const { data } = await supabase
    .from("verification_events")
    .select("*")
    .in("target_id", targetIds)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Row[];
}
