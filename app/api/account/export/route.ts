/**
 * RA 10173 data portability: everything we hold about the signed-in user, as JSON.
 * Uses the user's own session, so RLS returns only their rows.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";

export async function GET() {
  const user = await getCurrentUserClaims();
  const supabase = await createSupabaseServerClient();
  if (!user || !supabase) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const [profile, documents, plans, reports] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_documents").select("document_id, status, expires_on, notes, created_at, updated_at"),
    supabase.from("plans").select("id, title, goal, inputs, generated_plan, chosen_option, created_at, updated_at"),
    supabase.from("content_flags").select("target_type, target_id, reason, details, evidence_url, status, created_at").eq("user_id", user.id),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    service: "Marites PH",
    account: { id: user.id, email: user.email },
    profile: profile.data,
    tracked_documents: documents.data ?? [],
    saved_plans: plans.data ?? [],
    reports: reports.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="marites-ph-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
