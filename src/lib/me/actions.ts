"use server";

/**
 * Personal data actions (signed-in users; RLS limits every query to their own rows).
 *  - setMyDocument: track a document as have / in progress / need, with optional expiry.
 *  - deletePlan: remove a saved plan.
 *  - deleteAccount: RA 10173 right to erasure. Needs the secret key (deleting an
 *    auth user is an admin operation); cascades to profile, plans, tracked
 *    documents; reports stay without the user link.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const docInput = z.object({
  locale: z.string().refine(isLocale),
  documentId: z.guid(),
  status: z.enum(["none", "have", "in_progress", "need"]),
  expiresOn: z.iso.date().optional().or(z.literal("").transform(() => undefined)),
});

export async function setMyDocument(_prev: { status: string }, formData: FormData): Promise<{ status: "idle" | "saved" | "error" | "signin" }> {
  const parsed = docInput.safeParse({
    locale: formData.get("locale"),
    documentId: formData.get("documentId"),
    status: formData.get("status"),
    expiresOn: formData.get("expiresOn") ?? undefined,
  });
  if (!parsed.success) return { status: "error" };
  const user = await getCurrentUserClaims();
  if (!user) return { status: "signin" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error" };

  const { documentId, status, expiresOn, locale } = parsed.data;
  const { error } =
    status === "none"
      ? await supabase.from("user_documents").delete().eq("user_id", user.id).eq("document_id", documentId)
      : await supabase
          .from("user_documents")
          .upsert({ user_id: user.id, document_id: documentId, status, expires_on: expiresOn ?? null }, { onConflict: "user_id,document_id" });
  if (error) {
    console.error("set my document failed", error.code);
    return { status: "error" };
  }
  revalidatePath(`/${locale}/my-documents`);
  return { status: "saved" };
}

export async function deletePlan(formData: FormData): Promise<void> {
  const parsed = z.object({ locale: z.string().refine(isLocale), id: z.guid() }).safeParse({ locale: formData.get("locale"), id: formData.get("id") });
  if (!parsed.success) return;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase.from("plans").delete().eq("id", parsed.data.id); // RLS: own plans only
  revalidatePath(`/${parsed.data.locale}/plans`);
  redirect(`/${parsed.data.locale}/plans`);
}

export async function deleteAccount(_prev: { status: string }, formData: FormData): Promise<{ status: "idle" | "mismatch" | "unavailable" | "error" }> {
  const locale = String(formData.get("locale") ?? "");
  if (String(formData.get("confirm") ?? "").trim() !== "DELETE") return { status: "mismatch" };
  const user = await getCurrentUserClaims();
  if (!user) return { status: "error" };
  const service = createSupabaseServiceClient();
  if (!service) return { status: "unavailable" };

  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("delete account failed", error.status);
    return { status: "error" };
  }
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect(`/auth/cleared?locale=${isLocale(locale) ? locale : "en"}`);
}
