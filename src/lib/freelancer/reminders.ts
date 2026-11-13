/**
 * Filing reminders (pure planning + server job). For each taxpayer with email
 * reminders on, deadlines from PUBLISHED rules within the reminder window get a
 * reminder row (unique per deadline) and an email. Already-sent reminders are
 * never repeated. Email bodies contain no financial data.
 */
import type { Deadline } from "@/lib/engines/tax";

/** Deadlines whose reminder date (due minus daysBefore) is today or earlier, but not past due. */
export function remindersDue(deadlines: Deadline[], today: string, daysBefore: number): Deadline[] {
  return deadlines.filter((d) => {
    const remindOn = new Date(Date.parse(d.dueOn) - daysBefore * 86_400_000).toISOString().slice(0, 10);
    return remindOn <= today && today <= d.dueOn;
  });
}

export function reminderEmail(d: Deadline, locale: "en" | "fil", siteUrl: string): { subject: string; text: string } {
  const subject = locale === "fil" ? `Paalala: BIR ${d.formCode} (${d.period}) deadline sa ${d.dueOn}` : `Reminder: BIR ${d.formCode} (${d.period}) is due ${d.dueOn}`;
  const text =
    (locale === "fil"
      ? `Paalala mula sa Marites PH: ang BIR ${d.formCode} para sa ${d.period} ay due sa ${d.dueOn}.\n\nTingnan ang filing calendar mo: ${siteUrl}/fil/freelancer/calendar\n\nGabay lang ito, hindi tax advice. Kumpirmahin sa BIR o sa CPA mo.`
      : `Reminder from Marites PH: BIR ${d.formCode} for ${d.period} is due on ${d.dueOn}.\n\nSee your filing calendar: ${siteUrl}/en/freelancer/calendar\n\nThis is guidance, not tax advice. Confirm with BIR or your CPA.`) +
    "\n\nTo stop these emails, turn off reminders in your taxpayer profile.";
  return { subject, text };
}

/** Renewal reminder: once per period, 3 days before the end, unless the user stopped reminders. */
export const RENEWAL_REMINDER_DAYS = 3;
export function renewalDue(e: { current_period_end: string; status: string; renewal_reminded_at: string | null }, now: Date): boolean {
  const end = Date.parse(e.current_period_end);
  return e.status === "active" && !e.renewal_reminded_at && end > now.getTime() && end - now.getTime() <= RENEWAL_REMINDER_DAYS * 86_400_000;
}

/** Marites Alerts: only recent alerts are emailed (a later upgrade doesn't flood the inbox). */
export const ALERT_EMAIL_WINDOW_DAYS = 7;
