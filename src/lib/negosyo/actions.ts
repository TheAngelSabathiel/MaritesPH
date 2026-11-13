"use server";

/**
 * Marites Negosyo Server Actions (Negosyo plan only). Registration numbers and
 * employee names are encrypted; contribution amounts for a remittance are
 * computed on the server from published rules, never taken from the browser.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { requirePlan } from "@/lib/billing/access";
import { encryptField } from "@/lib/crypto/fields";
import { listTaxRules } from "@/lib/content/public";
import { computeContributions } from "@/lib/engines/contributions";
import { encryptionKey } from "@/lib/freelancer/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listEmployees } from "./data";

const blank = (v: FormDataEntryValue | null) => (v == null || String(v).trim() === "" ? undefined : String(v).trim());
const loc = z.string().refine(isLocale);

async function ctx() {
  const access = await requirePlan("negosyo");
  if (access.status !== "ok") return null;
  const supabase = await createSupabaseServerClient();
  return supabase ? { userId: access.userId, supabase } : null;
}

export async function createBusiness(formData: FormData): Promise<void> {
  const p = z.object({ locale: loc, name: z.string().trim().min(2).max(120), city: z.string().trim().max(80).optional() }).safeParse({ locale: formData.get("locale"), name: formData.get("name"), city: blank(formData.get("city")) });
  const c = await ctx();
  if (!p.success || !c) return;
  const { data, error } = await c.supabase.from("businesses").insert({ user_id: c.userId, name: p.data.name, city: p.data.city ?? null }).select("id").single();
  if (error || !data) redirect(`/${p.data.locale}/negosyo?error=limit`);
  redirect(`/${p.data.locale}/negosyo/${data.id}`);
}

const digit = z.preprocess((v) => (v === undefined ? null : v), z.coerce.number().int().min(0).max(9).nullable());
export async function updateBusiness(formData: FormData): Promise<void> {
  const p = z.object({
    locale: loc, id: z.guid(), name: z.string().trim().min(2).max(120), city: z.string().trim().max(80).optional(),
    business_type: z.enum(["sole_prop", "partnership", "corporation", "cooperative"]),
    registrationNo: z.string().max(40).optional(), sssNo: z.string().max(30).optional(), philhealthNo: z.string().max(30).optional(), pagibigNo: z.string().max(30).optional(),
    sss_due_digit: digit, philhealth_due_digit: digit,
  }).safeParse({
    locale: formData.get("locale"), id: formData.get("id"), name: formData.get("name"), city: blank(formData.get("city")), business_type: formData.get("business_type"),
    registrationNo: blank(formData.get("registrationNo")), sssNo: blank(formData.get("sssNo")), philhealthNo: blank(formData.get("philhealthNo")), pagibigNo: blank(formData.get("pagibigNo")),
    sss_due_digit: blank(formData.get("sss_due_digit")), philhealth_due_digit: blank(formData.get("philhealth_due_digit")),
  });
  const c = await ctx();
  if (!p.success || !c) return;
  const key = encryptionKey();
  const enc = (v?: string) => (v && key ? encryptField(v, key) : null);
  const d = p.data;
  await c.supabase.from("businesses").update({
    name: d.name, city: d.city ?? null, business_type: d.business_type, sss_due_digit: d.sss_due_digit, philhealth_due_digit: d.philhealth_due_digit,
    ...(key ? { registration_no_enc: enc(d.registrationNo), sss_no_enc: enc(d.sssNo), philhealth_no_enc: enc(d.philhealthNo), pagibig_no_enc: enc(d.pagibigNo) } : {}),
  }).eq("id", d.id);
  revalidatePath(`/${d.locale}/negosyo/${d.id}`);
}

export async function addEmployee(formData: FormData): Promise<void> {
  const p = z.object({ locale: loc, businessId: z.guid(), name: z.string().trim().min(2).max(120), salary: z.coerce.number().positive().max(9_999_999), start: z.iso.date().optional() }).safeParse({
    locale: formData.get("locale"), businessId: formData.get("businessId"), name: formData.get("name"), salary: String(formData.get("salary") ?? "").replace(/,/g, ""), start: blank(formData.get("start")),
  });
  const c = await ctx();
  const key = encryptionKey();
  if (!p.success || !c || !key) return; // names are always encrypted; without the key nothing is stored
  await c.supabase.from("employees").insert({ business_id: p.data.businessId, user_id: c.userId, name_enc: encryptField(p.data.name, key), monthly_salary: p.data.salary, start_date: p.data.start ?? null });
  revalidatePath(`/${p.data.locale}/negosyo/${p.data.businessId}`);
}

export async function setEmployeeActive(formData: FormData): Promise<void> {
  const p = z.object({ locale: loc, businessId: z.guid(), id: z.guid(), active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  const c = await ctx();
  if (!p.success || !c) return;
  await c.supabase.from("employees").update({ active: p.data.active === "true" }).eq("id", p.data.id);
  revalidatePath(`/${p.data.locale}/negosyo/${p.data.businessId}`);
}

export async function recordRemittance(formData: FormData): Promise<void> {
  const p = z.object({ locale: loc, businessId: z.guid(), agency: z.enum(["sss", "philhealth", "pagibig"]), period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), paidOn: z.iso.date() }).safeParse(Object.fromEntries(formData));
  const c = await ctx();
  if (!p.success || !c) return;
  const [{ rules }, employees] = await Promise.all([listTaxRules(), listEmployees(p.data.businessId)]);
  let ee = 0;
  let er = 0;
  for (const e of employees.filter((x) => x.active)) {
    const r = computeContributions(e.monthly_salary, `${p.data.period}-01`, rules);
    if (r.status !== "ok") return; // no published rules: nothing to record automatically
    const line = r.lines.find((l) => l.agency === p.data.agency)!;
    ee += line.employee;
    er += line.employer;
  }
  await c.supabase.from("remittances").upsert(
    { business_id: p.data.businessId, user_id: c.userId, agency: p.data.agency, period: p.data.period, employee_share: Math.round(ee * 100) / 100, employer_share: Math.round(er * 100) / 100, paid_on: p.data.paidOn },
    { onConflict: "business_id,agency,period" },
  );
  revalidatePath(`/${p.data.locale}/negosyo/${p.data.businessId}`);
}

export async function markPermitRenewed(formData: FormData): Promise<void> {
  const p = z.object({ locale: loc, businessId: z.guid(), year: z.coerce.number().int().min(2000).max(2100) }).safeParse(Object.fromEntries(formData));
  const c = await ctx();
  if (!p.success || !c) return;
  await c.supabase.from("businesses").update({ permit_renewed_for: p.data.year }).eq("id", p.data.businessId);
  revalidatePath(`/${p.data.locale}/negosyo/${p.data.businessId}`);
}

export async function deleteBusiness(formData: FormData): Promise<void> {
  const p = z.object({ locale: loc, id: z.guid(), confirm: z.literal("DELETE") }).safeParse(Object.fromEntries(formData));
  const c = await ctx();
  if (!p.success || !c) return;
  await c.supabase.from("businesses").delete().eq("id", p.data.id);
  redirect(`/${p.data.locale}/negosyo`);
}
