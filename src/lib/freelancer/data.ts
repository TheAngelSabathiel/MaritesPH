/** Freelancer data loaders (signed-in owner only; RLS enforces it too). */
import "server-only";
import { z } from "zod";
import { decryptField, parseKey } from "@/lib/crypto/fields";
import { serverEnv } from "@/lib/env.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const profileRow = z.object({
  taxpayer_type: z.enum(["freelancer", "sole_prop", "mixed"]),
  registration_status: z.enum(["not_registered", "registered"]),
  rdo_code: z.string().nullable(),
  tax_option: z.enum(["eight_percent", "graduated", "undecided"]),
  deduction_method: z.enum(["osd", "itemized"]),
  vat_status: z.enum(["non_vat", "vat"]),
  registered_on: z.string().nullable(),
  tin_enc: z.string().nullable(),
  registered_name_enc: z.string().nullable(),
  registered_address_enc: z.string().nullable(),
  email_reminders: z.boolean(),
  reminder_days_before: z.number(),
});
export type TaxpayerProfile = Omit<z.infer<typeof profileRow>, "tin_enc" | "registered_name_enc" | "registered_address_enc"> & {
  tin: string | null;
  registeredName: string | null;
  registeredAddress: string | null;
};

export const DEFAULT_PROFILE: TaxpayerProfile = {
  taxpayer_type: "freelancer", registration_status: "not_registered", rdo_code: null, tax_option: "undecided", deduction_method: "osd",
  vat_status: "non_vat", registered_on: null, tin: null, registeredName: null, registeredAddress: null, email_reminders: false, reminder_days_before: 7,
};

export function encryptionKey() {
  return parseKey(serverEnv().FIELD_ENCRYPTION_KEY);
}

export async function getMyProfile(userId: string): Promise<TaxpayerProfile | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("taxpayer_profiles").select("*").eq("user_id", userId).maybeSingle();
  const parsed = profileRow.safeParse(data);
  if (!parsed.success) return null;
  const key = encryptionKey();
  const { tin_enc, registered_name_enc, registered_address_enc, ...rest } = parsed.data;
  return {
    ...rest,
    tin: key ? decryptField(tin_enc, key) : null,
    registeredName: key ? decryptField(registered_name_enc, key) : null,
    registeredAddress: key ? decryptField(registered_address_enc, key) : null,
  };
}

export type Entry = { id: string; date: string; amount: number; currency: string; fx_rate: number; php_amount: number; category: string; notes: string | null };

export async function listEntries(kind: "income" | "expense", year: number): Promise<Entry[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const dateCol = kind === "income" ? "received_on" : "spent_on";
  const { data } = await supabase
    .from(kind === "income" ? "income_entries" : "expense_entries")
    .select(`id, ${dateCol}, amount, currency, fx_rate, php_amount, category, notes_enc`)
    .gte(dateCol, `${year}-01-01`)
    .lte(dateCol, `${year}-12-31`)
    .order(dateCol, { ascending: false });
  const key = encryptionKey();
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    date: String(r[dateCol]),
    amount: Number(r.amount),
    currency: String(r.currency),
    fx_rate: Number(r.fx_rate),
    php_amount: Number(r.php_amount),
    category: String(r.category),
    notes: key ? decryptField(r.notes_enc as string | null, key) : null,
  }));
}

/** PHP totals per quarter (index 0 = Q1). Pure. */
export function quarterTotals(entries: Pick<Entry, "date" | "php_amount">[]): number[] {
  const q = [0, 0, 0, 0];
  for (const e of entries) q[Math.floor((Number(e.date.slice(5, 7)) - 1) / 3)] += e.php_amount;
  return q.map((n) => Math.round(n * 100) / 100);
}
