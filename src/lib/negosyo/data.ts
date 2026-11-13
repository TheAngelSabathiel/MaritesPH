/** Marites Negosyo data loaders (owner only; RLS enforces it too). */
import "server-only";
import { decryptField } from "@/lib/crypto/fields";
import { encryptionKey } from "@/lib/freelancer/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Business = {
  id: string;
  name: string;
  business_type: string;
  city: string | null;
  sss_due_digit: number | null;
  philhealth_due_digit: number | null;
  permit_renewed_for: number | null;
  registrationNo: string | null;
  sssNo: string | null;
  philhealthNo: string | null;
  pagibigNo: string | null;
};
export type Employee = { id: string; name: string; monthly_salary: number; start_date: string | null; active: boolean };
export type Remittance = { agency: "sss" | "philhealth" | "pagibig"; period: string; employee_share: number; employer_share: number; paid_on: string };

export async function listBusinesses(): Promise<{ id: string; name: string; city: string | null }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase ? await supabase.from("businesses").select("id, name, city").order("created_at") : { data: [] };
  return (data ?? []) as { id: string; name: string; city: string | null }[];
}

export async function getBusiness(id: string): Promise<Business | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const key = encryptionKey();
  const dec = (v: unknown) => (key ? decryptField(v as string | null, key) : null);
  return {
    id: data.id, name: data.name, business_type: data.business_type, city: data.city,
    sss_due_digit: data.sss_due_digit, philhealth_due_digit: data.philhealth_due_digit, permit_renewed_for: data.permit_renewed_for,
    registrationNo: dec(data.registration_no_enc), sssNo: dec(data.sss_no_enc), philhealthNo: dec(data.philhealth_no_enc), pagibigNo: dec(data.pagibig_no_enc),
  };
}

export async function listEmployees(businessId: string): Promise<Employee[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("employees").select("id, name_enc, monthly_salary, start_date, active").eq("business_id", businessId).order("created_at");
  const key = encryptionKey();
  return ((data ?? []) as { id: string; name_enc: string; monthly_salary: number; start_date: string | null; active: boolean }[]).map((e) => ({
    id: e.id, name: (key && decryptField(e.name_enc, key)) || "•••", monthly_salary: Number(e.monthly_salary), start_date: e.start_date, active: e.active,
  }));
}

export async function listRemittances(businessId: string, sinceDays = 400): Promise<Remittance[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 7);
  const { data } = await supabase.from("remittances").select("agency, period, employee_share, employer_share, paid_on").eq("business_id", businessId).gte("period", since).order("period", { ascending: false });
  return ((data ?? []) as Remittance[]).map((r) => ({ ...r, employee_share: Number(r.employee_share), employer_share: Number(r.employer_share) }));
}

/** Previous calendar month in Manila (the period whose remittances fall due this month). */
export function previousPeriod(now: Date): string {
  const m = new Date(now.getTime() + 8 * 3_600_000);
  const y = m.getUTCFullYear();
  const mo = m.getUTCMonth(); // 0-based current month = previous month 1-based
  return mo === 0 ? `${y - 1}-12` : `${y}-${String(mo).padStart(2, "0")}`;
}
