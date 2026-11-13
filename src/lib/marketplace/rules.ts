/** Marketplace rules (pure). */
import { moderateTip } from "@/lib/community/moderation";

export const SERVICES = ["bir_registration", "bookkeeping", "tax_filing", "payroll", "business_registration", "audit", "tax_advisory"] as const;
export type Service = (typeof SERVICES)[number];

export const platformFee = (base: number, rate: number) => Math.round(base * rate * 100) / 100;

/**
 * Reviews and quote messages must not carry contact details: contacts are
 * exchanged only through the app when a professional accepts. Reuses the
 * anti-fixer patterns (phone numbers, emails, messaging links, "PM me").
 */
export function screenText(text: string): "ok" | "contact_details" {
  const { flags } = moderateTip(text);
  return flags.some((f) => f === "phone_number" || f === "email" || f === "messaging_link" || f === "contact_offer") ? "contact_details" : "ok";
}

export type DirectoryEntry = {
  user_id: string;
  display_name: string;
  profession: "cpa" | "bookkeeper";
  prc_license_no: string | null;
  license_valid_until: string | null;
  firm_name: string | null;
  bio: string | null;
  services: Service[];
  cities: string[];
  online_only: boolean;
  starting_fee_php: number | null;
  verified_at: string;
  rating_avg: number | null;
  rating_count: number;
};

/** Directory filter (pure, used in the browser). */
export function filterDirectory(list: DirectoryEntry[], f: { service?: string; city?: string }): DirectoryEntry[] {
  const city = f.city?.trim().toLowerCase();
  return list.filter(
    (e) => (!f.service || e.services.includes(f.service as Service)) && (!city || e.online_only || e.cities.some((c) => c.toLowerCase() === city)),
  );
}
