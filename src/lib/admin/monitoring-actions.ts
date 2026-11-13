"use server";

/**
 * Bantay Batas admin actions. A human decides every change:
 *  - approveProposal: re-checks that the record still has the "before" values
 *    (otherwise someone edited it since: re-review), applies the (optionally
 *    edited) values, stamps verification, attaches a draft legal reference,
 *    publishes the issuance to "Ano'ng Bago?", and creates alerts for users
 *    tracking the document. Tax records go to needs_cpa instead (Phase 7).
 *  - rejectProposal, confirm/reject links, publish/unpublish issuances,
 *    manage sources, dismiss signals, run the pipeline now.
 */
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { CONTENT_TAG } from "@/lib/content/public";
import { runMonitoring } from "@/lib/monitoring/run";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "./data";
import { adminPath, withMessage } from "./paths";
import { resourceForTargetType } from "./resources";
import { schemas } from "./schemas";
import { changedFields } from "./workflow";

const RANK: Record<string, number | undefined> = { republic_act: 1, irr: 2, executive_order: 2, regulation: 3, memorandum_circular: 3, order: 3, advisory: 4 };

async function ctxOrNull() {
  const ctx = await getAdminContext();
  return typeof ctx === "string" ? null : ctx;
}
const base = z.object({ locale: z.string().refine(isLocale), id: z.guid() });

function coerce(edited: string, after: unknown): unknown {
  const v = edited.trim();
  if (v === "") return null;
  if (typeof after === "number") return Number(v.replace(/,/g, ""));
  if (typeof after === "boolean") return v === "true";
  if (Array.isArray(after)) return v.split(",").map((x) => x.trim()).filter(Boolean);
  return v;
}

export async function approveProposal(formData: FormData): Promise<void> {
  const b = base.safeParse({ locale: formData.get("locale"), id: formData.get("id") });
  if (!b.success) return;
  const ctx = await ctxOrNull();
  if (!ctx) return;
  const { locale, id } = b.data;
  const page = adminPath(locale, "bantay-batas");

  const { data: p } = await ctx.supabase.from("change_proposals").select("*").eq("id", id).maybeSingle();
  if (!p || (p.status !== "open" && p.status !== "needs_cpa")) redirect(withMessage(page, "error", "Proposal not found or already reviewed."));
  const resource = resourceForTargetType(String(p.target_type));
  if (!resource) redirect(withMessage(page, "error", "This record type can't be changed here."));

  // Tax rules and deadlines: an admin's approval only forwards the proposal to a CPA.
  if (p.target_type === "tax_rule" || p.target_type === "tax_deadline") {
    await ctx.supabase.from("change_proposals").update({ status: "needs_cpa", review_note: String(formData.get("note") ?? "").slice(0, 1000) || null }).eq("id", id);
    revalidatePath(page);
    redirect(withMessage(page, "notice", "Sent to CPA review. A CPA must approve tax changes before they apply."));
  }
  const fields = (p.proposed_change as { fields: Record<string, { before: unknown; after: unknown }> }).fields;
  const { data: row } = await ctx.supabase.from(resource.table).select("*").eq("id", String(p.target_id)).maybeSingle();
  if (!row) redirect(withMessage(page, "error", "The record no longer exists."));

  // Stale check: the record must still hold the "before" values.
  const before = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.before]));
  if (changedFields(row, before, Object.keys(fields)).length) {
    redirect(withMessage(page, "error", "The record changed after this proposal was drafted. Compare it with the issuance and edit the record directly, then reject this proposal."));
  }

  const after = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => {
      const edited = formData.get(`f_${k}`);
      return [k, typeof edited === "string" ? coerce(edited, v.after) : v.after];
    }),
  );
  if (!schemas[resource.key].safeParse({ ...row, ...after }).success) redirect(withMessage(page, "error", "The edited values aren't valid for this record."));

  const now = new Date().toISOString();
  const note = String(formData.get("note") ?? "").slice(0, 1000) || null;
  const { error } = await ctx.supabase.from(resource.table).update({ ...after, last_verified_at: now, verified_by: ctx.userId }).eq("id", String(p.target_id));
  if (error) redirect(withMessage(page, "error", `Couldn't apply the change (${error.code}).`));

  await ctx.supabase.from("change_proposals").update({ status: "approved", reviewed_by: ctx.userId, reviewed_at: now, review_note: note, proposed_change: { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { before: v.before, after: after[k] }])) } }).eq("id", id);

  if (p.issuance_id) {
    const { data: iss } = await ctx.supabase.from("issuances").select("*").eq("id", String(p.issuance_id)).maybeSingle();
    if (iss) {
      await ctx.supabase.from("issuances").update({ published: true }).eq("id", String(iss.id));
      await ctx.supabase.from("issuance_links").update({ link_status: "confirmed" }).match({ issuance_id: String(iss.id), target_type: String(p.target_type), target_id: String(p.target_id) });
      const rank = RANK[String(iss.issuance_type)];
      if (rank) {
        const { data: existing } = await ctx.supabase.from("legal_references").select("id").match({ issuance_id: String(iss.id), target_type: String(p.target_type), target_id: String(p.target_id) }).limit(1);
        if (!existing?.length) {
          await ctx.supabase.from("legal_references").insert({
            target_type: String(p.target_type), target_id: String(p.target_id), issuance_id: String(iss.id), source_rank: rank,
            issuing_body: String(iss.issuing_body ?? "Unknown issuing body"), issuance_type: String(iss.issuance_type),
            issuance_number: iss.issuance_number ?? null, citation_title: String(iss.title).slice(0, 300), date_issued: iss.date_issued ?? null,
            source_url: String(iss.url), to_verify_note: "TO VERIFY: section and wording (created from Bantay Batas approval)",
          });
        }
      }
    }
  }

  // Alerts for people tracking the affected document (sent from Phase 8).
  const documentId = p.target_type === "document" ? String(p.target_id) : row.document_id ? String(row.document_id) : null;
  const service = createSupabaseServiceClient();
  if (documentId && service) {
    const { data: trackers } = await service.from("user_documents").select("user_id").eq("document_id", documentId);
    const reason = String(p.public_summary ?? "A document you track was updated.").slice(0, 300);
    const rows = ((trackers ?? []) as { user_id: string }[]).map((t) => ({ user_id: t.user_id, change_proposal_id: id, issuance_id: p.issuance_id, reason }));
    if (rows.length) await service.from("change_alerts").upsert(rows, { onConflict: "user_id,change_proposal_id", ignoreDuplicates: true });
  }

  revalidatePath(page);
  updateTag(CONTENT_TAG);
  redirect(withMessage(page, "notice", "Change applied, verified, and published to Ano'ng Bago."));
}

export async function rejectProposal(formData: FormData): Promise<void> {
  const b = base.safeParse({ locale: formData.get("locale"), id: formData.get("id") });
  const ctx = await ctxOrNull();
  if (!b.success || !ctx) return;
  const page = adminPath(b.data.locale, "bantay-batas");
  await ctx.supabase.from("change_proposals").update({ status: "rejected", reviewed_by: ctx.userId, reviewed_at: new Date().toISOString(), review_note: String(formData.get("note") ?? "").slice(0, 1000) || null }).eq("id", b.data.id);
  revalidatePath(page);
  redirect(withMessage(page, "notice", "Proposal rejected."));
}

export async function setLinkStatus(formData: FormData): Promise<void> {
  const b = base.safeParse({ locale: formData.get("locale"), id: formData.get("id") });
  const status = z.enum(["confirmed", "rejected"]).safeParse(formData.get("status"));
  const ctx = await ctxOrNull();
  if (!b.success || !status.success || !ctx) return;
  await ctx.supabase.from("issuance_links").update({ link_status: status.data }).eq("id", b.data.id);
  revalidatePath(adminPath(b.data.locale, "bantay-batas"));
}

export async function setIssuancePublished(formData: FormData): Promise<void> {
  const b = base.safeParse({ locale: formData.get("locale"), id: formData.get("id") });
  const ctx = await ctxOrNull();
  if (!b.success || !ctx) return;
  await ctx.supabase.from("issuances").update({ published: formData.get("published") === "true" }).eq("id", b.data.id);
  revalidatePath(adminPath(b.data.locale, "bantay-batas"));
  updateTag(CONTENT_TAG);
}

const sourceInput = z.object({
  locale: z.string().refine(isLocale),
  name: z.string().trim().min(2).max(200),
  url: z.string().trim().regex(/^https:\/\/\S+$/),
  source_type: z.enum(["rss", "html_list", "pdf_list", "manual"]),
  parser_key: z.enum(["auto", "rss", "html_links", "pdf_links", "manual"]),
  topic: z.enum(["ids", "tax", "business", "general"]),
  crawl_frequency_hours: z.coerce.number().int().min(6).max(720),
  link_pattern: z.string().trim().max(200).optional(),
});

export async function addSource(formData: FormData): Promise<void> {
  const parsed = sourceInput.safeParse(Object.fromEntries(formData));
  const ctx = await ctxOrNull();
  if (!parsed.success || !ctx) return;
  const { locale, link_pattern, ...rest } = parsed.data;
  const page = adminPath(locale, "source-health");
  const { error } = await ctx.supabase.from("official_sources").insert({ ...rest, parser_config: link_pattern ? { linkPattern: link_pattern } : {}, to_verify_note: "TO VERIFY: URL, site terms, and robots.txt before activating" });
  redirect(withMessage(page, error ? "error" : "notice", error ? `Couldn't add the source (${error.code}).` : "Source added (inactive until verified)."));
}

export async function updateSourceState(formData: FormData): Promise<void> {
  const b = base.safeParse({ locale: formData.get("locale"), id: formData.get("id") });
  const action = z.enum(["verify_activate", "pause", "delete"]).safeParse(formData.get("action"));
  const ctx = await ctxOrNull();
  if (!b.success || !action.success || !ctx) return;
  const page = adminPath(b.data.locale, "source-health");
  const q = ctx.supabase.from("official_sources");
  const { error } =
    action.data === "verify_activate" ? await q.update({ to_verify_note: null, active: true }).eq("id", b.data.id)
    : action.data === "pause" ? await q.update({ active: false }).eq("id", b.data.id)
    : await q.delete().eq("id", b.data.id);
  revalidatePath(page);
  if (error) redirect(withMessage(page, "error", `Couldn't update the source (${error.code}).`));
}

export async function dismissSignal(formData: FormData): Promise<void> {
  const b = base.safeParse({ locale: formData.get("locale"), id: formData.get("id") });
  const ctx = await ctxOrNull();
  if (!b.success || !ctx) return;
  await ctx.supabase.from("community_signals").update({ status: "dismissed" }).eq("id", b.data.id);
  revalidatePath(adminPath(b.data.locale, "signals"));
}

export async function runMonitoringNow(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "en");
  const ctx = await ctxOrNull();
  if (!ctx || !isLocale(locale)) return;
  const page = adminPath(locale, "source-health");
  const r = await runMonitoring(45_000);
  revalidatePath(page);
  redirect(withMessage(page, "error" in r ? "error" : "notice", "error" in r ? r.error : `Checked ${r.sourcesChecked} sources (${r.sourceFailures} failed), ${r.newIssuances} new issuances, ${r.classified} classified, ${r.proposals} proposals, ${r.signals} signals.`));
}
