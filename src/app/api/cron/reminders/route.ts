/**
 * Daily notifications (Vercel Cron, CRON_SECRET), sent through Resend:
 *  1. BIR filing reminders for opted-in taxpayers with an active Freelancer plan;
 *  2. Marites Alerts (approved changes to tracked documents) for users with an
 *     active paid plan, from the last 7 days;
 *  3. plan renewal reminders 3 days before the end (once per period).
 * Emails contain no financial data.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { filingCalendar, type DeadlineRow } from "@/lib/engines/tax";
import { ALERT_EMAIL_WINDOW_DAYS, reminderEmail, remindersDue, renewalDue } from "@/lib/freelancer/reminders";
import { hasAccess, type Entitlement } from "@/lib/billing/rules";
import { sendEmail } from "@/lib/notify/email";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = createSupabaseServiceClient();
  if (!db) return NextResponse.json({ error: "Supabase secret key not configured" }, { status: 503 });

  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10); // Manila date
  const year = Number(today.slice(0, 4));
  const { data: rows } = await db.from("tax_deadlines").select("*").eq("status", "published");
  const { data: people } = await db.from("taxpayer_profiles").select("user_id, tax_option, reminder_days_before").eq("email_reminders", true).limit(5000);
  const { data: locales } = await db.from("profiles").select("id, language_pref").in("id", ((people ?? []) as { user_id: string }[]).map((p) => p.user_id));
  const lang = new Map(((locales ?? []) as { id: string; language_pref: "en" | "fil" }[]).map((l) => [l.id, l.language_pref]));

  const { data: ents } = await db.from("entitlements").select("user_id, plan_key, current_period_end, status, renewal_reminded_at");
  const entByUser = new Map(((ents ?? []) as (Entitlement & { user_id: string; renewal_reminded_at: string | null })[]).map((e) => [e.user_id, e]));
  const now = new Date();
  const paid = (userId: string) => hasAccess(entByUser.get(userId) ?? null, "freelancer", now);
  const emailOf = async (userId: string) => (await db.auth.admin.getUserById(userId)).data?.user?.email ?? null;
  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  let created = 0;
  let sent = 0;
  for (const p of ((people ?? []) as { user_id: string; tax_option: "eight_percent" | "graduated" | "undecided"; reminder_days_before: number }[]).filter((x) => paid(x.user_id))) {
    // This year's deadlines plus last year's annual return (due this year).
    const deadlines = [...filingCalendar((rows ?? []) as DeadlineRow[], year, p.tax_option), ...filingCalendar((rows ?? []) as DeadlineRow[], year - 1, p.tax_option)];
    for (const d of remindersDue(deadlines, today, p.reminder_days_before)) {
      const { data: inserted, error } = await db
        .from("reminders")
        .upsert({ user_id: p.user_id, deadline_key: d.key, title: `${d.formCode} ${d.period}`, due_on: d.dueOn, remind_on: today }, { onConflict: "user_id,deadline_key", ignoreDuplicates: true })
        .select("id");
      if (error || !inserted?.length) continue; // already reminded
      created++;
      const email = await emailOf(p.user_id);
      if (!email) continue;
      const msg = reminderEmail(d, lang.get(p.user_id) ?? "en", site);
      if (await sendEmail(email, msg.subject, msg.text)) {
        sent++;
        await db.from("reminders").update({ sent_at: new Date().toISOString() }).eq("id", inserted[0].id);
      }
    }
  }
  // 2. Marites Alerts (paid plans only, recent alerts only).
  let alertsSent = 0;
  const since = new Date(now.getTime() - ALERT_EMAIL_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: alerts } = await db.from("change_alerts").select("id, user_id, reason").is("sent_at", null).gte("created_at", since).limit(2000);
  for (const a of (alerts ?? []) as { id: string; user_id: string; reason: string }[]) {
    if (!paid(a.user_id)) continue;
    const email = await emailOf(a.user_id);
    if (!email) continue;
    const fil = lang.get(a.user_id) === "fil";
    const ok = await sendEmail(
      email,
      fil ? "Marites Alerts: may update sa dokumentong sinusundan mo" : "Marites Alerts: an update to a document you track",
      `${a.reason}\n\n${fil ? "Tingnan ang detalye" : "See what changed"}: ${site}/${fil ? "fil" : "en"}/ano-ng-bago\n\n${fil ? "Para ihinto, alisin ang dokumento sa My documents." : "To stop these, remove the document from My documents."}`,
    );
    if (ok) {
      alertsSent++;
      await db.from("change_alerts").update({ sent_at: new Date().toISOString(), channel: "email" }).eq("id", a.id);
    }
  }

  // 3. Plan renewal reminders.
  let renewals = 0;
  for (const [userId, e] of entByUser) {
    if (!renewalDue(e, now)) continue;
    const email = await emailOf(userId);
    if (!email) continue;
    const fil = lang.get(userId) === "fil";
    const end = e.current_period_end.slice(0, 10);
    const ok = await sendEmail(
      email,
      fil ? `Matatapos ang plano mo sa ${end}` : `Your Marites plan ends on ${end}`,
      `${fil ? "Matatapos ang plano mo sa" : "Your plan ends on"} ${end}. ${fil ? "Walang awtomatikong singil. Para tumuloy, mag-renew dito" : "There's no automatic charge. To continue, renew here"}: ${site}/${fil ? "fil" : "en"}/pricing\n\n${fil ? "Para ihinto ang paalalang ito, buksan ang Billing." : "To stop these reminders, open Billing."}`,
    );
    if (ok) {
      renewals++;
      await db.from("entitlements").update({ renewal_reminded_at: new Date().toISOString() }).eq("user_id", userId);
    }
  }

  return NextResponse.json({ created, sent, alertsSent, renewals }, { headers: { "cache-control": "no-store" } });
}
