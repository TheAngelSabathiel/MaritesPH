/** Marketplace data. Directory and reviews are public and cached; requests are private to the two parties. */
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/content/public";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DirectoryEntry } from "./rules";

export async function listDirectory(): Promise<DirectoryEntry[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data } = await supabase.from("cpa_directory").select("*").order("rating_count", { ascending: false });
  return ((data ?? []) as DirectoryEntry[]).map((e) => ({ ...e, starting_fee_php: e.starting_fee_php == null ? null : Number(e.starting_fee_php), rating_avg: e.rating_avg == null ? null : Number(e.rating_avg) }));
}

export async function listReviews(cpaUserId: string): Promise<{ rating: number; comment: string | null; created_at: string }[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data } = await supabase.from("cpa_reviews").select("rating, comment, created_at").eq("cpa_user_id", cpaUserId).eq("status", "published").order("created_at", { ascending: false }).limit(20);
  return (data ?? []) as { rating: number; comment: string | null; created_at: string }[];
}

export type QuoteRow = {
  id: string; requester_id: string | null; cpa_user_id: string; service: string; message: string; city: string | null; status: string;
  cpa_reply: string | null; quoted_fee_php: number | null; final_fee_php: number | null; created_at: string;
};

export async function myQuotes(userId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { sent: [], received: [], contacts: new Map<string, { requester_email: string; cpa_email: string }>(), reviewed: new Set<string>(), names: new Map<string, string>() };
  const [{ data: rows }, { data: contacts }, { data: reviews }, { data: listings }] = await Promise.all([
    supabase.from("quote_requests").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("quote_contacts").select("request_id, requester_email, cpa_email"),
    supabase.from("cpa_reviews").select("request_id").eq("reviewer_id", userId),
    supabase.from("cpa_directory").select("user_id, display_name"),
  ]);
  const all = (rows ?? []) as QuoteRow[];
  return {
    sent: all.filter((q) => q.requester_id === userId),
    received: all.filter((q) => q.cpa_user_id === userId),
    contacts: new Map(((contacts ?? []) as { request_id: string; requester_email: string; cpa_email: string }[]).map((c) => [c.request_id, c])),
    reviewed: new Set(((reviews ?? []) as { request_id: string }[]).map((r) => r.request_id)),
    names: new Map(((listings ?? []) as { user_id: string; display_name: string }[]).map((l) => [l.user_id, l.display_name])),
  };
}

export async function myListing(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase ? await supabase.from("cpa_listings").select("*").eq("user_id", userId).maybeSingle() : { data: null };
  return data as (Omit<DirectoryEntry, "rating_avg" | "rating_count" | "verified_at"> & { contact_email: string; status: string; admin_note: string | null }) | null;
}
