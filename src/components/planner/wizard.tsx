"use client";

/**
 * "Ano'ng Lakad Mo?" wizard. Four short steps (one screen each on a phone),
 * then "Mga Diskarte". Plans are computed on the server by deterministic
 * engines from verified data; this component only collects answers and shows
 * the result. Location is used for this plan only and never saved.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useState, useSyncExternalStore, useTransition } from "react";
import { DAYS, type Day } from "@/lib/content/hours-core";
import type { PlanResult, SchedulePreset } from "@/lib/engines/planner";
import { generatePlan, myHaveList, savePlan } from "@/lib/planner/actions";
import { planTitle, type DayNames, type PlannerStrings } from "@/lib/planner/describe";
import type { PlannerFormInput } from "@/lib/planner/schema";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DiskarteView } from "./diskarte-view";
import { AiPlanSummary } from "./ai-summary";

export type WizardData = {
  documents: { id: string; slug: string; name: string }[];
  purposes: { key: string; label: string }[];
  cities: { slug: string; name: string; lat: number; lng: number }[];
};

type Props = {
  data: WizardData;
  locale: string;
  t: PlannerStrings;
  days: DayNames;
  freeLabel: string;
  /** Show "Ipaliwanag ni Marites" (only when AI is configured). */
  ai?: { enabled: boolean; t: import("@/i18n/dictionaries").Messages["aiSummary"] };
};

const PRESETS: SchedulePreset[] = ["office_8to5", "night_shift", "weekends_only", "flexible", "custom"];
const TOTAL_STEPS = 4;
const fieldClass = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base";

const noopSubscribe = () => () => {};

export function PlannerWizard(props: Props) {
  return (
    <Suspense fallback={<Wizard {...props} initialGoal={null} />}>
      <WizardFromUrl {...props} />
    </Suspense>
  );
}

function WizardFromUrl(props: Props) {
  const slug = useSearchParams().get("goal");
  const doc = slug ? props.data.documents.find((d) => d.slug === slug) : undefined;
  return <Wizard {...props} initialGoal={doc?.id ?? null} key={doc?.id ?? "none"} />;
}

function Wizard({ data, locale, t, days, freeLabel, ai, initialGoal }: Props & { initialGoal: string | null }) {
  const id = useId();
  const [step, setStep] = useState(initialGoal ? 1 : 0);
  // false during server render and hydration, true once interactive (exposed as data-ready for tests).
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [error, setError] = useState<string | null>(null);

  const [goalKind, setGoalKind] = useState<"document" | "purpose">("document");
  const [documentId, setDocumentId] = useState(initialGoal ?? "");
  const [purpose, setPurpose] = useState("");
  const [have, setHave] = useState<string[]>([]);
  const [prefilled, setPrefilled] = useState(false);
  const [preset, setPreset] = useState<SchedulePreset>("office_8to5");
  const [customDays, setCustomDays] = useState<Day[]>(["sat"]);
  const [customStart, setCustomStart] = useState("08:00");
  const [customEnd, setCustomEnd] = useState("12:00");
  const [leaveDays, setLeaveDays] = useState<0 | 1 | 2>(0);
  const [urgency, setUrgency] = useState<"asap" | "this_month" | "no_rush">("this_month");
  const [budget, setBudget] = useState("");
  const [city, setCity] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [transport, setTransport] = useState<"walk" | "commute" | "drive">("commute");

  const [result, setResult] = useState<PlanResult | null>(null);
  const [input, setInput] = useState<PlannerFormInput | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "signin" | "error">("idle");

  // Prefill "what you have" from My documents when signed in.
  useEffect(() => {
    let active = true;
    myHaveList().then((list) => {
      if (active && list.length) {
        setHave(list);
        setPrefilled(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function validate(current: number): boolean {
    if (current === 0 && ((goalKind === "document" && !documentId) || (goalKind === "purpose" && !purpose))) {
      setError(t.required);
      return false;
    }
    if (current === 2 && preset === "custom" && (customDays.length === 0 || customStart >= customEnd)) {
      setError(t.blocked.no_free_time);
      return false;
    }
    setError(null);
    return true;
  }

  function buildInput(): PlannerFormInput {
    const c = data.cities.find((x) => x.slug === city);
    const amount = Number(budget.replace(/[^0-9.]/g, ""));
    return {
      goal: goalKind === "document" ? { kind: "document", documentId } : { kind: "purpose", purpose },
      have: have.filter((h) => h !== documentId),
      origin: geo ?? (c ? { lat: c.lat, lng: c.lng } : null),
      schedule: preset === "custom" ? { preset, custom: { days: customDays, start: customStart, end: customEnd } } : { preset },
      leaveDays,
      urgency,
      budget: budget.trim() && Number.isFinite(amount) ? amount : null,
      transport,
    };
  }

  function submit() {
    if (!validate(step)) return;
    const next = buildInput();
    setInput(next);
    setSaveState("idle");
    startTransition(async () => {
      const r = await generatePlan(next);
      if (r.ok) setResult(r.result);
      else setError(t.required);
    });
  }

  async function save() {
    if (!input || !result || result.status !== "ok") return;
    setSaveState("saving");
    const goalName =
      input.goal.kind === "document"
        ? data.documents.find((d) => d.id === documentId)?.name ?? ""
        : data.purposes.find((p) => p.key === purpose)?.label ?? "";
    const r = await savePlan({ title: planTitle(t, goalName), input, chosen: result.recommended });
    setSaveState(r.status === "saved" ? "saved" : r.status === "signin" ? "signin" : "error");
  }

  if (result) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight">{t.resultsHeading}</h2>
          <Button type="button" variant="outline" onClick={() => setResult(null)}>
            {t.editAnswers}
          </Button>
        </div>
        {result.status === "ok" ? (
          <>
            <p className="text-muted-foreground">{t.resultsIntro}</p>
            {ai?.enabled && input ? <AiPlanSummary input={input} locale={locale === "fil" ? "fil" : "en"} t={ai.t} /> : null}
            <DiskarteView result={result} t={t} days={days} freeLabel={freeLabel} locale={locale} />
            <div className="space-y-2">
              {saveState === "saved" ? (
                <Alert tone="success">
                  {t.saved}{" "}
                  <Link href={`/${locale}/plans`} className="font-semibold underline">
                    {t.plansTitle}
                  </Link>
                </Alert>
              ) : saveState === "signin" ? (
                <Alert tone="caution">
                  <Link href={`/${locale}/login`} className="inline-flex min-h-11 items-center font-semibold underline">
                    {t.saveSignIn}
                  </Link>
                </Alert>
              ) : (
                <Button type="button" onClick={save} disabled={saveState === "saving"} className="w-full sm:w-auto">
                  {saveState === "saving" ? t.saving : t.save}
                </Button>
              )}
              {saveState === "error" ? <Alert tone="caution">{t.saveError}</Alert> : null}
            </div>
          </>
        ) : result.status === "already_satisfied" ? (
          <Alert tone="success">
            <p className="font-bold">{t.alreadyHave}</p>
            <p>
              {t.alreadyHaveBody.replace(
                "{documents}",
                result.satisfiedBy.map((d) => data.documents.find((x) => x.id === d)?.name ?? "").filter(Boolean).join(", "),
              )}
            </p>
          </Alert>
        ) : (
          <Alert tone="caution">{t.blocked[result.reason]}</Alert>
        )}
        <p className="text-sm text-muted-foreground">{t.disclaimer}</p>
      </div>
    );
  }

  const goalOptions = data.documents;
  return (
    <form
      data-ready={ready ? "true" : "false"}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (step < TOTAL_STEPS - 1) {
          if (validate(step)) setStep(step + 1);
        } else submit();
      }}
    >
      <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
        {t.stepOf.replace("{n}", String(step + 1)).replace("{total}", String(TOTAL_STEPS))}
      </p>

      {step === 0 ? (
        <fieldset className="min-w-0 space-y-4">
          <legend className="mb-3 text-xl font-bold">{t.goalHeading}</legend>
          <RadioRow name={`${id}-goalkind`} value={goalKind} onChange={(v) => setGoalKind(v as "document" | "purpose")} options={[["document", t.goalDocument], ["purpose", t.goalPurpose]]} />
          {goalKind === "document" ? (
            <Labeled id={`${id}-doc`} label={t.documentLabel}>
              <select id={`${id}-doc`} value={documentId} onChange={(e) => setDocumentId(e.target.value)} className={fieldClass}>
                <option value="">{t.chooseOne}</option>
                {goalOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Labeled>
          ) : (
            <Labeled id={`${id}-purpose`} label={t.purposeLabel}>
              <select id={`${id}-purpose`} value={purpose} onChange={(e) => setPurpose(e.target.value)} className={fieldClass}>
                <option value="">{t.chooseOne}</option>
                {data.purposes.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Labeled>
          )}
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="min-w-0 space-y-3">
          <legend className="mb-1 text-xl font-bold">{t.haveHeading}</legend>
          <p className="text-muted-foreground">{t.haveIntro}</p>
          {prefilled ? <p className="text-sm font-semibold">{t.haveSignedInNote}</p> : null}
          <ul className="divide-y rounded-lg border bg-card">
            {data.documents
              .filter((d) => goalKind !== "document" || d.id !== documentId)
              .map((d) => (
                <li key={d.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0"
                      checked={have.includes(d.id)}
                      onChange={(e) => setHave((h) => (e.target.checked ? [...h, d.id] : h.filter((x) => x !== d.id)))}
                    />
                    <span>{d.name}</span>
                  </label>
                </li>
              ))}
          </ul>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-2 text-xl font-bold">{t.scheduleHeading}</legend>
            {PRESETS.map((p) => (
              <label key={p} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 has-[:checked]:border-primary">
                <input type="radio" name={`${id}-preset`} value={p} checked={preset === p} onChange={() => setPreset(p)} className="mt-1 size-5 shrink-0" />
                <span>
                  <span className="block font-semibold">{t.schedulePresets[p]}</span>
                  <span className="block text-sm text-muted-foreground">{t.schedulePresetHints[p]}</span>
                </span>
              </label>
            ))}
            {preset === "custom" ? (
              <div className="space-y-3 rounded-lg border bg-muted/50 p-3">
                <p className="text-sm font-semibold">{t.customDays}</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <label key={d} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-3">
                      <input type="checkbox" className="size-5" checked={customDays.includes(d)} onChange={(e) => setCustomDays((cur) => (e.target.checked ? [...cur, d] : cur.filter((x) => x !== d)))} />
                      {days[d]}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Labeled id={`${id}-from`} label={t.customFrom}>
                    <Input id={`${id}-from`} type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                  </Labeled>
                  <Labeled id={`${id}-to`} label={t.customTo}>
                    <Input id={`${id}-to`} type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                  </Labeled>
                </div>
              </div>
            ) : null}
          </fieldset>
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-2 font-bold">{t.leaveHeading}</legend>
            <RadioRow name={`${id}-leave`} value={String(leaveDays)} onChange={(v) => setLeaveDays(Number(v) as 0 | 1 | 2)} options={(["0", "1", "2"] as const).map((k) => [k, t.leaveOptions[k]])} />
          </fieldset>
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-2 font-bold">{t.urgencyHeading}</legend>
            <RadioRow name={`${id}-urgency`} value={urgency} onChange={(v) => setUrgency(v as typeof urgency)} options={(["asap", "this_month", "no_rush"] as const).map((k) => [k, t.urgencyOptions[k]])} />
          </fieldset>
          <Labeled id={`${id}-budget`} label={t.budgetLabel} hint={t.budgetHint}>
            <Input id={`${id}-budget`} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="₱" />
          </Labeled>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <fieldset className="min-w-0 space-y-3">
            <legend className="mb-2 text-xl font-bold">{t.locationHeading}</legend>
            <Labeled id={`${id}-city`} label={t.cityLabel}>
              <select id={`${id}-city`} value={city} onChange={(e) => { setCity(e.target.value); setGeo(null); }} className={fieldClass}>
                <option value="">{t.anyCity}</option>
                {data.cities.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Labeled>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() =>
                navigator.geolocation?.getCurrentPosition(
                  (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setCity(""); },
                  () => setGeo(null),
                  { timeout: 15_000, maximumAge: 300_000 },
                )
              }
            >
              {t.useLocation}
            </Button>
            {geo ? <p className="text-sm font-semibold text-stamp">{t.locationSet}</p> : null}
            <p className="text-sm text-muted-foreground">{t.locationNote}</p>
          </fieldset>
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-2 font-bold">{t.transportHeading}</legend>
            <RadioRow name={`${id}-transport`} value={transport} onChange={(v) => setTransport(v as typeof transport)} options={(["walk", "commute", "drive"] as const).map((k) => [k, t.transportOptions[k]])} />
          </fieldset>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="font-semibold text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => { setError(null); setStep(step - 1); }}>
            {t.back}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? t.working : step < TOTAL_STEPS - 1 ? t.next : t.makePlan}
        </Button>
      </div>
    </form>
  );
}

function Labeled({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RadioRow({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: (readonly [string, string])[] }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {options.map(([v, label]) => (
        <label key={v} className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 has-[:checked]:border-primary has-[:checked]:font-semibold">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="size-5 shrink-0" />
          {label}
        </label>
      ))}
    </div>
  );
}
