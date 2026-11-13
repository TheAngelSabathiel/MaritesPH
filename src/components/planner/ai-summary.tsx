"use client";

/** "Ipaliwanag ni Marites": optional AI rephrasing of the recommended option, labeled as AI-written. */
import { useState, useTransition } from "react";
import type { Messages } from "@/i18n/dictionaries";
import type { PlanSummary } from "@/lib/ai/plan-summary";
import { summarizePlan } from "@/lib/planner/actions";
import type { PlannerFormInput } from "@/lib/planner/schema";
import { Button } from "@/components/ui/button";

export function AiPlanSummary({ input, locale, t }: { input: PlannerFormInput; locale: "en" | "fil"; t: Messages["aiSummary"] }) {
  const [summary, setSummary] = useState<PlanSummary | null | undefined>(undefined);
  const [pending, start] = useTransition();
  if (summary === undefined) {
    return (
      <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => setSummary(await summarizePlan(input, locale)))}>
        {pending ? t.working : t.button}
      </Button>
    );
  }
  if (!summary) return <p className="text-sm text-muted-foreground">{t.unavailable}</p>;
  return (
    <aside className="space-y-1 rounded-lg border bg-accent p-4 text-accent-foreground">
      <p className="font-extrabold">{summary.headline}</p>
      <p>{summary.summary}</p>
      <p className="text-xs">{t.label}</p>
    </aside>
  );
}
