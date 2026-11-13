/**
 * Public content queries for guide and office pages.
 *
 * - Cached with 'use cache' and tagged CONTENT_TAG. Admin Server Actions call
 *   updateTag(CONTENT_TAG) after every change, so publishing or unpublishing
 *   shows up on the next request. cacheLife("hours") also refreshes freshness
 *   warnings ("may be outdated") within an hour of a record crossing the threshold.
 * - Uses the cookie-free publishable-key client: RLS returns only published rows.
 *   Queries also filter status = 'published' explicitly (defense in depth).
 * - Every row is validated with Zod; rows that don't match are dropped, never
 *   shown half-parsed.
 */
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { hoursSchema } from "./hours";
import { groupRequirements, type RequirementGroup, type RequirementRow } from "./requirements";
import type { PublicOffice } from "./offices";

export const CONTENT_TAG = "content";

/** Document types shown under /ids. Registrations and permits get /business in later phases. */
export const PERSONAL_DOCUMENT_TYPES = ["id", "certificate", "clearance", "other"] as const;
/** Document types shown under /business (registrations and permits, e.g. BIR registration). */
export const BUSINESS_DOCUMENT_TYPES = ["registration", "permit", "filing"] as const;
export type GuideScope = "personal" | "business";
const typesFor = (scope: GuideScope): string[] => [...(scope === "business" ? BUSINESS_DOCUMENT_TYPES : PERSONAL_DOCUMENT_TYPES)];

const id = z.guid();
const text = z.string().nullable();
const num = z.coerce.number().nullable();

const documentRow = z.object({
  id,
  slug: z.string(),
  name: z.string(),
  type: z.string(),
  agency_id: id.nullable(),
  purpose_tags: z.array(z.string()).nullable(),
  description: text,
  validity_text: text,
  validity_months: num,
  processing_days_min: num,
  processing_days_max: num,
  processing_note: text,
  fee_min: num,
  fee_max: num,
  fee_note: text,
  source_url: text,
  last_verified_at: text,
});

const agencyRow = z.object({ id, name: z.string(), acronym: text, official_url: text });

const requirementRow = z.object({
  id,
  group_key: z.string(),
  option_key: z.string(),
  sort_order: z.number(),
  requires_document_id: id.nullable(),
  requirement_text: text,
  quantity: z.number(),
  notes: text,
  source_url: text,
  last_verified_at: text,
});

const stepRow = z.object({
  id,
  step_order: z.number(),
  title: z.string(),
  body_md: z.string(),
  is_online: z.boolean(),
  estimated_minutes: num,
  source_url: text,
  last_verified_at: text,
});

const legalRow = z.object({
  id,
  target_type: z.string(),
  target_id: id,
  source_rank: z.number(),
  issuing_body: z.string(),
  issuance_type: z.string(),
  issuance_number: text,
  citation_title: z.string(),
  date_issued: text,
  section: text,
  note: text,
  source_url: text,
  last_verified_at: text,
});

const officeRow = z.object({
  id,
  slug: z.string(),
  agency_id: id,
  name: z.string(),
  address: text,
  region: text,
  province: text,
  city: text,
  barangay: text,
  lat: num,
  lng: num,
  hours: hoursSchema.catch({}),
  hours_note: text,
  accepts_walk_in: z.boolean().nullable(),
  appointment_url: text,
  source_url: text,
  last_verified_at: text,
});

/** Parse each row; drop (and log) rows that don't match instead of failing the page. */
function parseRows<T>(schema: z.ZodType<T>, rows: unknown[] | null, what: string): T[] {
  const out: T[] = [];
  for (const row of rows ?? []) {
    const parsed = schema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
    else console.error(`public content: dropped invalid ${what} row`);
  }
  return out;
}

export type PublicDocument = z.infer<typeof documentRow>;
export type PublicAgency = z.infer<typeof agencyRow>;
export type PublicRequirement = RequirementRow &
  z.infer<typeof requirementRow> & { requiredDocument: { slug: string; name: string } | null };
export type PublicStep = z.infer<typeof stepRow>;
export type PublicLegalReference = z.infer<typeof legalRow> & { appliesTo: string | null };

export type Guide = {
  document: PublicDocument;
  agency: PublicAgency | null;
  requirementGroups: RequirementGroup<PublicRequirement>[];
  steps: PublicStep[];
  acceptedFor: { purpose: string; notes: string | null }[];
  legal: PublicLegalReference[];
  offices: PublicOffice[];
  /** Oldest verification date among everything shown: the honest "last verified". */
  oldestVerifiedAt: string | null;
  /** Distinct official sources used on the page. */
  sources: string[];
};

const DOCUMENT_COLUMNS =
  "id, slug, name, type, agency_id, purpose_tags, description, validity_text, validity_months, processing_days_min, processing_days_max, processing_note, fee_min, fee_max, fee_note, source_url, last_verified_at";

/** Published personal documents (IDs, certificates, clearances) for the /ids index. */
export async function listGuides(scope: GuideScope = "personal"): Promise<(PublicDocument & { agency: PublicAgency | null })[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];

  const [docs, agencies] = await Promise.all([
    supabase
      .from("documents")
      .select(DOCUMENT_COLUMNS)
      .eq("status", "published")
      .in("type", typesFor(scope))
      .order("name"),
    supabase.from("agencies").select("id, name, acronym, official_url").eq("status", "published"),
  ]);
  const agencyById = new Map(parseRows(agencyRow, agencies.data, "agency").map((a) => [a.id, a]));
  return parseRows(documentRow, docs.data, "document").map((d) => ({
    ...d,
    agency: d.agency_id ? agencyById.get(d.agency_id) ?? null : null,
  }));
}

/** Slugs for generateStaticParams. */
export async function listGuideSlugs(scope: GuideScope = "personal"): Promise<string[]> {
  return (await listGuides(scope)).map((d) => d.slug);
}

export async function getGuide(slug: string, scope: GuideScope = "personal"): Promise<Guide | null> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase || !/^[a-z0-9-]{1,100}$/.test(slug)) return null;

  const { data: docData } = await supabase
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .in("type", typesFor(scope))
    .maybeSingle();
  const [document] = parseRows(documentRow, docData ? [docData] : [], "document");
  if (!document) return null;

  const [agencyRes, reqRes, stepRes, purposeRes, allDocsRes, serviceRes] = await Promise.all([
    document.agency_id
      ? supabase.from("agencies").select("id, name, acronym, official_url").eq("id", document.agency_id).eq("status", "published").maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("document_requirements")
      .select("id, group_key, option_key, sort_order, requires_document_id, requirement_text, quantity, notes, source_url, last_verified_at")
      .eq("document_id", document.id)
      .eq("status", "published"),
    supabase
      .from("guide_steps")
      .select("id, step_order, title, body_md, is_online, estimated_minutes, source_url, last_verified_at")
      .eq("document_id", document.id)
      .eq("status", "published")
      .order("step_order"),
    supabase.from("accepted_for").select("purpose, notes, last_verified_at").eq("document_id", document.id).eq("status", "published"),
    supabase.from("documents").select("id, slug, name, type").eq("status", "published"),
    supabase.from("office_services").select("office_id").eq("document_id", document.id).eq("status", "published"),
  ]);

  const [agency] = parseRows(agencyRow, agencyRes.data ? [agencyRes.data] : [], "agency");
  const docNames = new Map(
    ((allDocsRes.data ?? []) as { id: string; slug: string; name: string; type: string }[]).map((d) => [
      d.id,
      { slug: d.slug, name: d.name },
    ]),
  );
  const requirements: PublicRequirement[] = parseRows(requirementRow, reqRes.data, "requirement").map((r) => ({
    ...r,
    requiredDocument: r.requires_document_id ? docNames.get(r.requires_document_id) ?? null : null,
  }));
  const steps = parseRows(stepRow, stepRes.data, "step");
  const acceptedFor = ((purposeRes.data ?? []) as { purpose: string; notes: string | null; last_verified_at: string | null }[]).map(
    ({ purpose, notes }) => ({ purpose, notes }),
  );

  // Legal basis for the document itself and for its requirements and steps.
  const labels = new Map<string, string | null>([[document.id, null]]);
  for (const r of requirements) labels.set(r.id, r.requiredDocument?.name ?? r.requirement_text);
  for (const s of steps) labels.set(s.id, s.title);
  const { data: legalData } = await supabase
    .from("legal_references")
    .select("id, target_type, target_id, source_rank, issuing_body, issuance_type, issuance_number, citation_title, date_issued, section, note, source_url, last_verified_at")
    .in("target_id", [...labels.keys()])
    .eq("status", "published")
    .order("source_rank")
    .order("date_issued", { ascending: false, nullsFirst: false });
  const legal = parseRows(legalRow, legalData, "legal reference").map((l) => ({ ...l, appliesTo: labels.get(l.target_id) ?? null }));

  const officeIds = ((serviceRes.data ?? []) as { office_id: string }[]).map((s) => s.office_id);
  const offices = officeIds.length ? (await listOffices()).filter((o) => officeIds.includes(o.id)) : [];

  const dates = [document.last_verified_at, ...requirements.map((r) => r.last_verified_at), ...steps.map((s) => s.last_verified_at)].filter(
    (d): d is string => Boolean(d),
  );
  const oldestVerifiedAt = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const sources = [
    ...new Set(
      [document.source_url, ...requirements.map((r) => r.source_url), ...steps.map((s) => s.source_url)].filter((u): u is string => Boolean(u)),
    ),
  ];

  return {
    document,
    agency: agency ?? null,
    requirementGroups: groupRequirements(requirements),
    steps,
    acceptedFor,
    legal,
    offices,
    oldestVerifiedAt,
    sources,
  };
}

/** All published offices with their agency and published services. */
export async function listOffices(): Promise<PublicOffice[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];

  const [officeRes, agencyRes, serviceRes, docRes] = await Promise.all([
    supabase
      .from("offices")
      .select("id, slug, agency_id, name, address, region, province, city, barangay, lat, lng, hours, hours_note, accepts_walk_in, appointment_url, source_url, last_verified_at")
      .eq("status", "published")
      .order("city")
      .order("name"),
    supabase.from("agencies").select("id, name, acronym, official_url").eq("status", "published"),
    supabase.from("office_services").select("office_id, document_id").eq("status", "published"),
    supabase.from("documents").select("id, slug, name").eq("status", "published"),
  ]);

  const agencies = new Map(parseRows(agencyRow, agencyRes.data, "agency").map((a) => [a.id, a]));
  const docs = new Map(((docRes.data ?? []) as { id: string; slug: string; name: string }[]).map((d) => [d.id, d]));
  const services = (serviceRes.data ?? []) as { office_id: string; document_id: string }[];

  return parseRows(officeRow, officeRes.data, "office").flatMap((o) => {
    const agency = agencies.get(o.agency_id);
    if (!agency) return []; // an office of an unpublished agency is not shown
    return [
      {
        id: o.id,
        slug: o.slug,
        name: o.name,
        address: o.address,
        region: o.region,
        province: o.province,
        city: o.city,
        barangay: o.barangay,
        lat: o.lat,
        lng: o.lng,
        hours: o.hours,
        hoursNote: o.hours_note,
        acceptsWalkIn: o.accepts_walk_in,
        appointmentUrl: o.appointment_url,
        sourceUrl: o.source_url,
        lastVerifiedAt: o.last_verified_at,
        agency: { id: agency.id, name: agency.name, acronym: agency.acronym },
        documents: services
          .filter((s) => s.office_id === o.id)
          .map((s) => docs.get(s.document_id))
          .filter((d): d is { id: string; slug: string; name: string } => Boolean(d)),
      },
    ];
  });
}

/** Legal references attached directly to an office or its services. */
export async function listOfficeLegal(officeId: string): Promise<PublicLegalReference[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("legal_references")
    .select("id, target_type, target_id, source_rank, issuing_body, issuance_type, issuance_number, citation_title, date_issued, section, note, source_url, last_verified_at")
    .eq("target_type", "office")
    .eq("target_id", officeId)
    .eq("status", "published")
    .order("source_rank");
  return parseRows(legalRow, data, "legal reference").map((l) => ({ ...l, appliesTo: null }));
}

/**
 * "Now", cached for up to an hour. Cached pages can't read the clock directly
 * (Cache Components), so freshness checks use this: staleness warnings are
 * accurate to within an hour.
 */
export async function cachedNow(): Promise<number> {
  "use cache";
  cacheLife("hours");
  return Date.now();
}

/**
 * Snapshot of published content for the planning engines (src/lib/engines).
 * Only published documents, requirements, steps, purposes, and offices: the
 * planner can never route someone through unverified information.
 */
export async function getPlannerCatalog(): Promise<import("@/lib/engines/types").Catalog> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return { documents: [], offices: [] };

  const [docRes, reqRes, stepRes, purposeRes, agencyRes, offices, waitRes] = await Promise.all([
    supabase.from("documents").select(DOCUMENT_COLUMNS).eq("status", "published").order("name"),
    supabase
      .from("document_requirements")
      .select("id, document_id, group_key, option_key, sort_order, requires_document_id, requirement_text, quantity")
      .eq("status", "published"),
    supabase.from("guide_steps").select("id, document_id, is_online").eq("status", "published"),
    supabase.from("accepted_for").select("document_id, purpose").eq("status", "published"),
    supabase.from("agencies").select("id, name, acronym, official_url").eq("status", "published"),
    listOffices(),
    supabase.from("office_wait_stats").select("office_id, median_wait_minutes, reports"),
  ]);

  // Only offices with at least 3 recent approved reports, so one tip can't swing a ranking.
  const waitMinutes = Object.fromEntries(
    ((waitRes.data ?? []) as { office_id: string; median_wait_minutes: number; reports: number }[])
      .filter((w) => w.reports >= 3)
      .map((w) => [w.office_id, w.median_wait_minutes]),
  );
  const agencies = new Map(parseRows(agencyRow, agencyRes.data, "agency").map((a) => [a.id, a]));
  type ReqRow = { id: string; document_id: string; group_key: string; option_key: string; requires_document_id: string | null; requirement_text: string | null; quantity: number };
  const reqs = (reqRes.data ?? []) as ReqRow[];
  const steps = (stepRes.data ?? []) as { id: string; document_id: string; is_online: boolean }[];
  const purposes = (purposeRes.data ?? []) as { document_id: string; purpose: string }[];

  const documents = parseRows(documentRow, docRes.data, "document").map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    agencyName: d.agency_id ? agencies.get(d.agency_id)?.name ?? null : null,
    feeMin: d.fee_min,
    feeMax: d.fee_max,
    processingDaysMin: d.processing_days_min,
    processingDaysMax: d.processing_days_max,
    purposes: purposes.filter((p) => p.document_id === d.id).map((p) => p.purpose),
    requirements: reqs
      .filter((r) => r.document_id === d.id)
      .map((r) => ({ id: r.id, groupKey: r.group_key, optionKey: r.option_key, documentId: r.requires_document_id, text: r.requirement_text, quantity: r.quantity })),
    steps: steps.filter((s) => s.document_id === d.id).map((s) => ({ id: s.id, isOnline: s.is_online })),
    lastVerifiedAt: d.last_verified_at,
  }));
  return { documents, offices, waitMinutes };
}

/** Approved community tips for an office (Chika sa Pila), newest first. */
export async function listApprovedTips(officeId: string): Promise<{ id: string; body: string; wait_minutes: number | null; extra_requirements_asked: string | null; visited_on: string | null; created_at: string }[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("tips")
    .select("id, body, wait_minutes, extra_requirements_asked, visited_on, created_at")
    .eq("office_id", officeId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as Awaited<ReturnType<typeof listApprovedTips>>;
}

/** Median reported wait for an office, shown only with at least 3 recent approved reports. */
export async function getOfficeWait(officeId: string): Promise<{ minutes: number; count: number } | null> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return null;
  const { data } = await supabase.from("office_wait_stats").select("median_wait_minutes, reports").eq("office_id", officeId).maybeSingle();
  if (!data || Number(data.reports) < 3) return null;
  return { minutes: Number(data.median_wait_minutes), count: Number(data.reports) };
}

export type FeedItem = {
  id: string;
  kind: "change" | "issuance";
  date: string;
  topic: "ids" | "tax" | "business" | "general";
  title: string;
  summary: string | null;
  issuingBody: string | null;
  issuanceNumber: string | null;
  url: string | null;
  /** For changes: the guide it updated, when that guide is public. */
  guideSlug: string | null;
};

/** "Ano'ng Bago?": approved changes and published issuances, newest first. */
export async function listFeed(): Promise<FeedItem[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const [changes, issuances, docs] = await Promise.all([
    supabase.from("change_proposals").select("id, issuance_id, target_type, target_id, public_summary, reviewed_at").eq("status", "approved").order("reviewed_at", { ascending: false }).limit(100),
    supabase.from("issuances").select("id, title, url, issuing_body, issuance_number, date_issued, topic, summary, created_at").eq("published", true).order("created_at", { ascending: false }).limit(100),
    supabase.from("documents").select("id, slug, name").eq("status", "published"),
  ]);
  type Iss = { id: string; title: string; url: string; issuing_body: string | null; issuance_number: string | null; date_issued: string | null; topic: FeedItem["topic"]; summary: string | null; created_at: string };
  const iss = (issuances.data ?? []) as Iss[];
  const issById = new Map(iss.map((i) => [i.id, i]));
  const docById = new Map(((docs.data ?? []) as { id: string; slug: string; name: string }[]).map((d) => [d.id, d]));
  const changeItems: FeedItem[] = ((changes.data ?? []) as { id: string; issuance_id: string | null; target_type: string; target_id: string; public_summary: string | null; reviewed_at: string }[])
    .filter((c) => c.public_summary)
    .map((c) => {
      const i = c.issuance_id ? issById.get(c.issuance_id) : undefined;
      const d = c.target_type === "document" ? docById.get(c.target_id) : undefined;
      return {
        id: c.id, kind: "change", date: c.reviewed_at, topic: i?.topic ?? "general", title: c.public_summary!, summary: d ? d.name : null,
        issuingBody: i?.issuing_body ?? null, issuanceNumber: i?.issuance_number ?? null, url: i?.url ?? null, guideSlug: d?.slug ?? null,
      };
    });
  const issuanceItems: FeedItem[] = iss.map((i) => ({
    id: i.id, kind: "issuance", date: i.date_issued ?? i.created_at, topic: i.topic, title: i.title, summary: i.summary,
    issuingBody: i.issuing_body, issuanceNumber: i.issuance_number, url: i.url, guideSlug: null,
  }));
  return [...changeItems, ...issuanceItems].sort((a, b) => b.date.localeCompare(a.date));
}

/** Published, CPA-reviewed tax rules and deadlines (the only ones the tax tools use). */
export async function listTaxRules(): Promise<{ rules: import("@/lib/engines/tax").RuleRow[]; deadlines: import("@/lib/engines/tax").DeadlineRow[] }> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return { rules: [], deadlines: [] };
  const [r, d] = await Promise.all([
    supabase.from("tax_rules").select("id, rule_key, parameters, effective_from, effective_to, cpa_reviewed, source_url").eq("status", "published"),
    supabase.from("tax_deadlines").select("id, form_code, frequency, due_rule, applies_to, description, effective_from, effective_to, cpa_reviewed, source_url").eq("status", "published"),
  ]);
  return { rules: (r.data ?? []) as import("@/lib/engines/tax").RuleRow[], deadlines: (d.data ?? []) as import("@/lib/engines/tax").DeadlineRow[] };
}

export type PublicPlan = { key: "freelancer" | "negosyo"; name: string; monthly_price_php: number; rank: number };
/** Active subscription plans with prices (set by admins). */
export async function listPlans(): Promise<PublicPlan[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data } = await supabase.from("subscription_plans").select("key, name, monthly_price_php, rank").eq("active", true).order("rank");
  return ((data ?? []) as PublicPlan[]).map((p) => ({ ...p, monthly_price_php: Number(p.monthly_price_php) }));
}

/** Published permit renewal process for a city (Marites Negosyo planner). */
export async function getRenewalProcess(city: string): Promise<import("@/lib/engines/lgu").LguProcess | null> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase || !city) return null;
  const { data } = await supabase
    .from("lgu_processes")
    .select("id, city, process_type, title, steps, requirements, fees, deadlines, source_url, last_verified_at")
    .eq("status", "published")
    .eq("process_type", "business_permit_renewal")
    .ilike("city", city.trim())
    .maybeSingle();
  return (data as import("@/lib/engines/lgu").LguProcess | null) ?? null;
}

/** Cities that have a published renewal process (for the city picker). */
export async function listRenewalCities(): Promise<string[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data } = await supabase.from("lgu_processes").select("city").eq("status", "published").eq("process_type", "business_permit_renewal").order("city");
  return ((data ?? []) as { city: string }[]).map((r) => r.city);
}
