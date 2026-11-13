"use server";

/**
 * Admin Server Actions. Each one: checks the caller is an admin, validates
 * input with Zod, applies the verification workflow rules, then writes with
 * the admin's own session (RLS is the final gate). No government data is
 * logged; errors are logged by database code only.
 */
import { revalidatePath, updateTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/content/public";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { safeRelativePath } from "@/lib/safe-redirect";
import { getAdminContext, getRecord, parentOf, type Row } from "./data";
import { parseRecordForm, type FieldErrors } from "./form";
import { adminPath, recordPath, withMessage } from "./paths";
import { factualFields, resourceBySlug, resources, type ResourceDef } from "./resources";
import {
  applyEdit,
  canDelete,
  changedFields,
  checkReverify,
  checkTransition,
  STATUSES,
  type VerificationState,
} from "./workflow";

export type SaveState = { errors?: FieldErrors; formError?: string };

const baseInput = z.object({
  locale: z.string().refine(isLocale),
  resource: z.string(),
  id: z.guid().optional(),
});

function readBase(formData: FormData) {
  const parsed = baseInput.safeParse({
    locale: formData.get("locale"),
    resource: formData.get("resource"),
    id: formData.get("id") || undefined,
  });
  if (!parsed.success) return null;
  const resource = resourceBySlug(parsed.data.resource);
  if (!resource) return null;
  return { ...parsed.data, resourceDef: resource };
}

function toVerificationState(row: Row): VerificationState {
  return {
    status: row.status as VerificationState["status"],
    source_url: (row.source_url as string | null) ?? null,
    last_verified_at: (row.last_verified_at as string | null) ?? null,
    to_verify_note: (row.to_verify_note as string | null) ?? null,
    cpa_reviewed: (row.cpa_reviewed as boolean | undefined) ?? undefined,
  };
}

/** Where to go after saving: child records return to their parent's page. */
async function pageFor(
  ctx: Exclude<Awaited<ReturnType<typeof getAdminContext>>, string>,
  locale: string,
  resource: ResourceDef,
  id: string,
  row: Row,
): Promise<string> {
  if (resource.parent) {
    return recordPath(locale, resources[resource.parent.resource], String(row[resource.parent.column]));
  }
  if (resource.polymorphicParent) {
    const parent = await parentOf(ctx.supabase, resource.key, id);
    const parentResource = parent ? resources[parent.parentType as keyof typeof resources] : undefined;
    if (parent && parentResource) return recordPath(locale, parentResource, parent.parentId);
  }
  return recordPath(locale, resource, id);
}

/** Translate database errors into messages an admin can act on. */
function dbErrorMessage(error: { code?: string; message?: string }): SaveState {
  if (error.code === "23505") return { formError: "That value is already used by another record (for example, the URL slug)." };
  if (error.code === "23514") return { formError: "The database rejected this change because a rule was not met (for example, publishing without a source)." };
  if (error.code === "23P01") return { formError: "Another live version overlaps these dates." };
  if (error.code === "23503") return { formError: "A linked record doesn't exist or is still in use." };
  if (error.code === "42501") return { formError: "You don't have permission to do that." };
  return { formError: "Couldn't save. Please try again." };
}

export async function saveRecord(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const base = readBase(formData);
  if (!base) return { formError: "Invalid request." };
  const ctx = await getAdminContext();
  if (typeof ctx === "string") return { formError: "Admins only. Please sign in again." };

  const { locale, id, resourceDef: resource } = base;
  const parsed = parseRecordForm(resource, (name) => {
    const v = formData.get(name);
    return typeof v === "string" ? v : null;
  });
  if (!parsed.ok) return { errors: parsed.errors };

  let values: Row = parsed.values;
  let notice = "Saved.";
  let savedId = id;

  if (id) {
    const before = await getRecord(ctx.supabase, resource, id);
    if (!before) return { formError: "This record no longer exists." };
    const changed = changedFields(before, values, factualFields(resource));
    const reverified = formData.get("reverified") === "on";
    const result = applyEdit(toVerificationState(before), values as Pick<VerificationState, "source_url" | "to_verify_note">, changed, reverified, {
      now: new Date(),
      actorId: ctx.userId,
    });
    if (!result.ok) return { formError: result.reason };
    values = { ...values, ...result.patch };
    if (result.notice) notice = result.notice;

    const { error } = await ctx.supabase.from(resource.table).update(values).eq("id", id);
    if (error) {
      console.error("admin update failed", resource.table, error.code);
      return dbErrorMessage(error);
    }
  } else {
    const { data, error } = await ctx.supabase.from(resource.table).insert(values).select("id").single();
    if (error || !data) {
      console.error("admin insert failed", resource.table, error?.code);
      return dbErrorMessage(error ?? {});
    }
    savedId = String(data.id);
    notice = "Created as a draft.";
  }

  revalidatePath(adminPath(locale), "layout");
  updateTag(CONTENT_TAG); // public guide/office pages reflect the change on the next request
  redirect(withMessage(await pageFor(ctx, locale, resource, savedId!, values), "notice", notice));
}

const transitionInput = z.object({ to: z.enum(STATUSES) });

export async function transitionRecord(formData: FormData): Promise<void> {
  const base = readBase(formData);
  const target = transitionInput.safeParse({ to: formData.get("to") });
  if (!base || !base.id || !target.success) return;
  const ctx = await getAdminContext();
  if (typeof ctx === "string") return;

  const { locale, id, resourceDef: resource } = base;
  const before = await getRecord(ctx.supabase, resource, id);
  if (!before) return;
  const page = await pageFor(ctx, locale, resource, id, before);

  const result = checkTransition(toVerificationState(before), target.data.to, {
    now: new Date(),
    actorId: ctx.userId,
    requiresCpaReview: resource.table === "tax_rules" || resource.table === "tax_deadlines",
  });
  if (!result.ok) redirect(withMessage(page, "error", result.reason));

  const { error } = await ctx.supabase.from(resource.table).update(result.patch).eq("id", id);
  if (error) {
    console.error("admin transition failed", resource.table, error.code);
    redirect(withMessage(page, "error", dbErrorMessage(error).formError ?? "Couldn't change status."));
  }
  revalidatePath(adminPath(locale), "layout");
  updateTag(CONTENT_TAG);
  redirect(withMessage(page, "notice", `Status changed to ${target.data.to}.`));
}

export async function reverifyRecord(formData: FormData): Promise<void> {
  const base = readBase(formData);
  if (!base || !base.id) return;
  const ctx = await getAdminContext();
  if (typeof ctx === "string") return;

  const { locale, id, resourceDef: resource } = base;
  const back = safeRelativePath(String(formData.get("return_to") ?? ""), adminPath(locale, "stale"));
  const before = await getRecord(ctx.supabase, resource, id);
  if (!before) redirect(withMessage(back, "error", "Record not found."));

  const result = checkReverify(toVerificationState(before), { now: new Date(), actorId: ctx.userId });
  if (!result.ok) redirect(withMessage(back, "error", result.reason));

  const { error } = await ctx.supabase.from(resource.table).update(result.patch).eq("id", id);
  if (error) redirect(withMessage(back, "error", "Couldn't re-verify."));
  revalidatePath(adminPath(locale), "layout");
  updateTag(CONTENT_TAG);
  redirect(withMessage(back, "notice", "Re-verified as of today."));
}

export async function deleteRecord(formData: FormData): Promise<void> {
  const base = readBase(formData);
  if (!base || !base.id) return;
  const ctx = await getAdminContext();
  if (typeof ctx === "string") return;

  const { locale, id, resourceDef: resource } = base;
  const before = await getRecord(ctx.supabase, resource, id);
  if (!before) return;
  const page = await pageFor(ctx, locale, resource, id, before);
  const afterDelete =
    resource.parent || resource.polymorphicParent ? page : adminPath(locale, resource.slug);

  if (!canDelete(toVerificationState(before))) {
    redirect(withMessage(page, "error", "Only drafts that were never verified can be deleted. Archive it instead."));
  }
  const { error } = await ctx.supabase.from(resource.table).delete().eq("id", id);
  if (error) {
    console.error("admin delete failed", resource.table, error.code);
    redirect(withMessage(page, "error", error.code === "23503" ? "Other records still point to this one." : "Couldn't delete."));
  }
  revalidatePath(adminPath(locale), "layout");
  updateTag(CONTENT_TAG);
  redirect(withMessage(afterDelete, "notice", `${resource.singular} deleted.`));
}

const flagInput = z.object({
  locale: z.string().refine(isLocale),
  id: z.guid(),
  status: z.enum(["resolved", "dismissed"]),
  note: z.string().trim().max(1000).optional(),
});

export async function resolveFlag(formData: FormData): Promise<void> {
  const parsed = flagInput.safeParse({
    locale: formData.get("locale"),
    id: formData.get("id"),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return;
  const ctx = await getAdminContext();
  if (typeof ctx === "string") return;

  const { locale, id, status, note } = parsed.data;
  const { error } = await ctx.supabase
    .from("content_flags")
    .update({ status, resolution_note: note ?? null, resolved_by: ctx.userId, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open");
  const page = adminPath(locale, "flags");
  if (error) redirect(withMessage(page, "error", "Couldn't update the flag."));
  revalidatePath(page);
  redirect(withMessage(page, "notice", status === "resolved" ? "Flag resolved." : "Flag dismissed."));
}

const tipDecision = z.object({
  locale: z.string().refine(isLocale),
  id: z.guid(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(300).optional(),
});

/** Approve or reject a community tip. Approved tips go public on the next request. */
export async function moderateTipAction(formData: FormData): Promise<void> {
  const parsed = tipDecision.safeParse({
    locale: formData.get("locale"),
    id: formData.get("id"),
    decision: formData.get("decision"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return;
  const ctx = await getAdminContext();
  if (typeof ctx === "string") return;
  const { locale, id, decision, reason } = parsed.data;
  const page = adminPath(locale, "tips");
  const { error } = await ctx.supabase
    .from("tips")
    .update({ status: decision, moderation_reason: reason ?? null, reviewed_by: ctx.userId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) redirect(withMessage(page, "error", "Couldn't update the tip."));
  revalidatePath(page);
  updateTag(CONTENT_TAG);
  redirect(withMessage(page, "notice", decision === "approved" ? "Tip approved and public." : "Tip rejected."));
}
