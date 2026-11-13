import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { formatPhDate } from "@/lib/content/freshness";
import type { PlanResult } from "@/lib/engines/planner";
import { deletePlan } from "@/lib/me/actions";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DiskarteView } from "@/components/planner/diskarte-view";

type Props = PageProps<"/[locale]/plans/[id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getDictionaryFor(isLocale(locale) ? locale : "en");
  return { title: t.planner.plansTitle, robots: { index: false, follow: false } };
}

export default function SavedPlanPage(props: Props) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Suspense fallback={null}>
        <Saved params={props.params} />
      </Suspense>
    </div>
  );
}

/** A plan is only rendered if the stored snapshot still has the expected shape. */
function isOkPlan(value: unknown): value is Extract<PlanResult, { status: "ok" }> {
  const v = value as { status?: unknown; options?: unknown; recommended?: unknown; reasons?: unknown } | null;
  return Boolean(v && v.status === "ok" && Array.isArray(v.options) && typeof v.recommended === "string" && Array.isArray(v.reasons));
}

async function Saved({ params }: { params: Props["params"] }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t: Messages = await getDictionaryFor(locale);
  const user = await getCurrentUserClaims();
  if (!user) redirect(`/${locale}/login`);
  const supabase = await createSupabaseServerClient();
  const { data } = supabase ? await supabase.from("plans").select("id, title, generated_plan, chosen_option, created_at").eq("id", id).maybeSingle() : { data: null };
  if (!data) notFound();
  const plan = data.generated_plan as unknown;
  const loc: Locale = locale;

  return (
    <>
      <Link href={`/${locale}/plans`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">
        {t.planner.plansTitle}
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight">{String(data.title)}</h1>
      <p className="text-sm text-muted-foreground">{t.planner.savedOn.replace("{date}", formatPhDate(String(data.created_at), loc))}</p>
      <Alert tone="caution">{t.planner.snapshotNote}</Alert>
      {isOkPlan(plan) ? (
        <DiskarteView result={plan} t={t.planner} days={t.offices.days} freeLabel={t.guides.feeFree} locale={locale} chosen={(data.chosen_option as string | null) ?? null} />
      ) : null}
      <form action={deletePlan}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="ghost" className="text-destructive">
          {t.planner.deletePlan}
        </Button>
      </form>
    </>
  );
}
