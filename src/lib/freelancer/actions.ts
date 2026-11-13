"use server";

/**
 * Freelancer Server Actions. Owner-only (RLS), Zod-validated, never logged.
 * Sensitive fields are encrypted before storage; if the encryption key is
 * missing, those fields are NOT saved (everything else is) and the user is told.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { encryptField } from "@/lib/crypto/fields";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { freelancerAccess } from "./access";
import { encryptionKey } from "./data";

export type FormState = { status: "idle" | "saved" | "error" | "partial" | "signin" | "upgrade" };
const blank = (v: FormDataEntryValue | null) => (v == null || String(v).trim() === "" ? undefined : String(v).trim());

const profileInput = z.object({
  locale: z.string().refine(isLocale),
  taxpayer_type: z.enum(["freelancer", "sole_prop", "mixed"]),
  registration_status: z.enum(["not_registered", "registered"]),
  rdo_code: z.string().regex(/^[0-9]{2,3}[A-Z]?$/).optional(),
  tax_option: z.enum(["eight_percent", "graduated", "undecided"]),
  deduction_method: z.enum(["osd", "itemized"]),
  vat_status: z.enum(["non_vat", "vat"]),
  registered_on: z.iso.date().optional(),
  tin: z.string().regex(/^[0-9-]{9,17}$/).optional(),
  registered_name: z.string().max(200).optional(),
  registered_address: z.string().max(500).optional(),
  email_reminders: z.boolean(),
  reminder_days_before: z.coerce.number().int().min(1).max(30),
});

export async function saveTaxpayerProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await freelancerAccess();
  if (access.status !== "ok") return { status: access.status };
  const parsed = profileInput.safeParse({
    locale: formData.get("locale"),
    taxpayer_type: formData.get("taxpayer_type"),
    registration_status: formData.get("registration_status"),
    rdo_code: blank(formData.get("rdo_code"))?.toUpperCase(),
    tax_option: formData.get("tax_option"),
    deduction_method: formData.get("deduction_method"),
    vat_status: formData.get("vat_status"),
    registered_on: blank(formData.get("registered_on")),
    tin: blank(formData.get("tin")),
    registered_name: blank(formData.get("registered_name")),
    registered_address: blank(formData.get("registered_address")),
    email_reminders: formData.get("email_reminders") === "on",
    reminder_days_before: formData.get("reminder_days_before") ?? 7,
  });
  if (!parsed.success) return { status: "error" };
  const { locale, tin, registered_name, registered_address, ...plain } = parsed.data;

  const key = encryptionKey();
  const wantsPrivate = Boolean(tin || registered_name || registered_address);
  const enc = (v?: string) => (v && key ? encryptField(v, key) : null);
  const row = {
    user_id: access.userId,
    ...plain,
    rdo_code: plain.rdo_code ?? null,
    registered_on: plain.registered_on ?? null,
    ...(key ? { tin_enc: enc(tin), registered_name_enc: enc(registered_name), registered_address_enc: enc(registered_address) } : {}),
  };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error" };
  const { error } = await supabase.from("taxpayer_profiles").upsert(row, { onConflict: "user_id" });
  if (error) return { status: "error" };
  revalidatePath(`/${locale}/freelancer`, "layout");
  return { status: wantsPrivate && !key ? "partial" : "saved" };
}

const entryInput = z.object({
  locale: z.string().refine(isLocale),
  kind: z.enum(["income", "expense"]),
  date: z.iso.date(),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  fx_rate: z.coerce.number().positive().max(100_000),
  category: z.string().regex(/^[a-z_]+$/),
  notes: z.string().max(300).optional(),
});

export async function addEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await freelancerAccess();
  if (access.status !== "ok") return { status: access.status };
  const currency = String(formData.get("currency") ?? "PHP").toUpperCase();
  const parsed = entryInput.safeParse({
    locale: formData.get("locale"),
    kind: formData.get("kind"),
    date: formData.get("date"),
    amount: String(formData.get("amount") ?? "").replace(/,/g, ""),
    currency,
    fx_rate: currency === "PHP" ? 1 : String(formData.get("fx_rate") ?? "").replace(/,/g, ""),
    category: formData.get("category"),
    notes: blank(formData.get("notes")),
  });
  if (!parsed.success) return { status: "error" };
  const e = parsed.data;
  const key = encryptionKey();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error" };
  // PHP amount is computed here (and checked by the database), never taken from the browser.
  const php = Math.round(e.amount * e.fx_rate * 100) / 100;
  const { error } = await supabase.from(e.kind === "income" ? "income_entries" : "expense_entries").insert({
    user_id: access.userId,
    [e.kind === "income" ? "received_on" : "spent_on"]: e.date,
    amount: e.amount,
    currency: e.currency,
    fx_rate: e.fx_rate,
    php_amount: php,
    category: e.category,
    notes_enc: e.notes && key ? encryptField(e.notes, key) : null,
  });
  if (error) return { status: "error" };
  revalidatePath(`/${e.locale}/freelancer`, "layout");
  return { status: e.notes && !key ? "partial" : "saved" };
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const p = z.object({ locale: z.string().refine(isLocale), kind: z.enum(["income", "expense"]), id: z.guid() }).safeParse({
    locale: formData.get("locale"), kind: formData.get("kind"), id: formData.get("id"),
  });
  if (!p.success || (await freelancerAccess()).status !== "ok") return;
  const supabase = await createSupabaseServerClient();
  await supabase?.from(p.data.kind === "income" ? "income_entries" : "expense_entries").delete().eq("id", p.data.id);
  revalidatePath(`/${p.data.locale}/freelancer`, "layout");
}
