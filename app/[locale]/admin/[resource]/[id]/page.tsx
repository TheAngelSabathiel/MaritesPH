import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocale } from "@/i18n/config";
import {
  auditTrail,
  getRecord,
  listLegalReferences,
  listRecords,
  parentOf,
  referenceOptions,
  requireAdmin,
  targetOptions,
  type Option,
  type Row,
} from "@/lib/admin/data";
import { newRecordPath, recordPath, adminPath } from "@/lib/admin/paths";
import { resourceBySlug, resources, type ResourceDef, type ResourceKey } from "@/lib/admin/resources";
import type { VerificationState } from "@/lib/admin/workflow";
import { groupRequirements, humanizeKey, type RequirementRow } from "@/lib/content/requirements";
import { officePath } from "@/lib/content/offices";
import { PERSONAL_DOCUMENT_TYPES } from "@/lib/content/public";
import { AdminLoading } from "@/components/admin/loading";
import { AuditTrail } from "@/components/admin/audit-trail";
import { ChildItems, ChildSection, type ChildItem } from "@/components/admin/child-section";
import { RecordForm } from "@/components/admin/record-form";
import { WorkflowPanel } from "@/components/admin/workflow-panel";

type Props = PageProps<"/[locale]/admin/[resource]/[id]">;

export default function RecordPage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <RecordView {...props} />
    </Suspense>
  );
}

function stateOf(row: Row): VerificationState {
  return {
    status: row.status as VerificationState["status"],
    source_url: (row.source_url as string | null) ?? null,
    last_verified_at: (row.last_verified_at as string | null) ?? null,
    to_verify_note: (row.to_verify_note as string | null) ?? null,
  };
}

async function RecordView({ params }: Props) {
  const { locale, resource: slug, id } = await params;
  const resource = resourceBySlug(slug);
  if (!resource || !isLocale(locale)) notFound();
  const { supabase } = await requireAdmin(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const row = await getRecord(supabase, resource, id);
  if (!row) notFound();

  // Where "Back" goes, and the parent id for child forms.
  let backHref = resource.topLevel ? adminPath(locale, resource.slug) : adminPath(locale);
  let parentValue: string | undefined;
  if (resource.parent) {
    parentValue = String(row[resource.parent.column]);
    backHref = recordPath(locale, resources[resource.parent.resource], parentValue);
  }

  const options: Record<string, Option[]> = {};
  for (const field of resource.fields) {
    if (field.kind === "reference" && field.references) options[field.name] = await referenceOptions(supabase, field.references);
  }
  if (resource.polymorphicParent) {
    const parent = await parentOf(supabase, resource.key, id);
    if (parent) {
      backHref = recordPath(locale, resources[parent.parentType as ResourceKey], parent.parentId);
      options.target = await targetOptions(supabase, parent.parentType, parent.parentId);
    }
  }

  const state = stateOf(row);
  const publicHref = await publicPageFor(supabase, locale, resource.key, row);
  const title = String(row[resource.labelColumn] ?? resource.singular);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={backHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">
          Back
        </Link>
        <p className="text-sm font-semibold text-muted-foreground">{resource.singular}</p>
        <h1 className="break-words text-2xl font-extrabold tracking-tight">{resource.key === "document_requirement" ? "Requirement" : title}</h1>
      </div>

      <WorkflowPanel resource={resource} id={id} state={state} locale={locale} />

      {state.status === "published" && publicHref ? (
        <Link href={publicHref} className="inline-flex min-h-11 items-center font-semibold text-primary underline" target="_blank">
          View public page
        </Link>
      ) : null}

      <details className="group rounded-lg border bg-card" open={resource.topLevel ? undefined : true}>
        <summary className="flex min-h-11 cursor-pointer items-center px-4 font-bold">Edit details</summary>
        <div className="border-t p-4">
          <RecordForm
            resource={resource}
            locale={locale}
            id={id}
            values={row}
            options={options}
            parentValue={parentValue}
            showReverify={state.status === "verified" || state.status === "published"}
          />
        </div>
      </details>

      {resource.key === "document" ? <DocumentChildren supabase={supabase} locale={locale} id={id} /> : null}
      {resource.key === "office" ? <OfficeChildren supabase={supabase} locale={locale} id={id} /> : null}
      {resource.key === "agency" ? <LegalSection supabase={supabase} locale={locale} parent={resource} id={id} targetIds={[id]} labels={{ [id]: title }} /> : null}
    </div>
  );
}

/** Public URL of a published document or office, for the admin's "View public page" link. */
async function publicPageFor(supabase: SupabaseClient, locale: string, key: ResourceKey, row: Row): Promise<string | null> {
  if (key === "document") {
    return PERSONAL_DOCUMENT_TYPES.includes(String(row.type) as (typeof PERSONAL_DOCUMENT_TYPES)[number]) ? `/${locale}/ids/${String(row.slug)}` : null;
  }
  if (key === "office") {
    const { data } = await supabase.from("agencies").select("name, acronym").eq("id", String(row.agency_id)).maybeSingle();
    if (!data) return null;
    return officePath(locale, { slug: String(row.slug), city: (row.city as string | null) ?? null, agency: { name: String(data.name), acronym: (data.acronym as string | null) ?? null } });
  }
  return null;
}

function item(locale: string, resource: ResourceDef, r: Row, label: string, meta?: string): ChildItem {
  return {
    id: String(r.id),
    href: recordPath(locale, resource, String(r.id)),
    label,
    status: String(r.status),
    note: (r.to_verify_note as string | null) ?? null,
    meta,
  };
}

async function DocumentChildren({ supabase, locale, id }: { supabase: SupabaseClient; locale: string; id: string }) {
  const [requirements, steps, purposes, docOptions] = await Promise.all([
    listRecords(supabase, resources.document_requirement, { parentId: id }),
    listRecords(supabase, resources.guide_step, { parentId: id }),
    listRecords(supabase, resources.accepted_for, { parentId: id }),
    referenceOptions(supabase, "document"),
  ]);
  const docName = new Map(docOptions.map((o) => [o.value, o.label]));
  const groups = groupRequirements(requirements as unknown as (RequirementRow & Row)[]);
  const reqLabel = (r: Row) =>
    r.requires_document_id ? docName.get(String(r.requires_document_id)) ?? "Document" : String(r.requirement_text);

  const labels: Record<string, string> = { [id]: "Document" };
  for (const r of requirements) labels[String(r.id)] = `Requirement: ${reqLabel(r)}`;
  for (const s of steps) labels[String(s.id)] = `Step ${String(s.step_order)}`;
  for (const p of purposes) labels[String(p.id)] = `Accepted for ${String(p.purpose)}`;

  return (
    <>
      <ChildSection
        title="Requirements"
        description="Every group is required. Within a group, any one option is enough; an option needs all of its items."
        addHref={newRecordPath(locale, resources.document_requirement, { id })}
        addLabel="Add requirement"
      >
        {groups.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : null}
        <ol className="space-y-4">
          {groups.map((g) => (
            <li key={g.groupKey} className="space-y-2">
              <h3 className="font-semibold">
                {humanizeKey(g.groupKey)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {g.options.length > 1 ? `required, any one of ${g.options.length} options` : "required"}
                </span>
              </h3>
              {g.options.map((o, i) => (
                <div key={o.optionKey} className="space-y-1">
                  {g.options.length > 1 ? (
                    <p className="text-sm font-semibold text-muted-foreground">
                      {i === 0 ? "Option" : "OR option"} {o.optionKey}
                      {o.items.length > 1 ? " (all of these)" : ""}
                    </p>
                  ) : null}
                  <ChildItems items={o.items.map((r) => item(locale, resources.document_requirement, r, reqLabel(r)))} />
                </div>
              ))}
            </li>
          ))}
        </ol>
      </ChildSection>

      <ChildSection
        title="Guide steps"
        addHref={newRecordPath(locale, resources.guide_step, { id })}
        addLabel="Add step"
        items={steps.map((s) =>
          item(locale, resources.guide_step, s, `${String(s.step_order)}. ${String(s.title)}`, s.is_online ? "Online" : undefined),
        )}
      />

      <ChildSection
        title="Accepted for"
        description="Purposes this document can be used for, such as opening a bank account."
        addHref={newRecordPath(locale, resources.accepted_for, { id })}
        addLabel="Add purpose"
        items={purposes.map((p) => item(locale, resources.accepted_for, p, String(p.purpose)))}
      />

      <LegalSection
        supabase={supabase}
        locale={locale}
        parent={resources.document}
        id={id}
        targetIds={[id, ...requirements.map((r) => String(r.id)), ...steps.map((s) => String(s.id)), ...purposes.map((p) => String(p.id))]}
        labels={labels}
      />
    </>
  );
}

async function OfficeChildren({ supabase, locale, id }: { supabase: SupabaseClient; locale: string; id: string }) {
  const [services, docOptions] = await Promise.all([
    listRecords(supabase, resources.office_service, { parentId: id }),
    referenceOptions(supabase, "document"),
  ]);
  const docName = new Map(docOptions.map((o) => [o.value, o.label]));
  const labels: Record<string, string> = { [id]: "Office" };
  for (const s of services) labels[String(s.id)] = `Service: ${docName.get(String(s.document_id)) ?? "document"}`;

  return (
    <>
      <ChildSection
        title="Services at this office"
        addHref={newRecordPath(locale, resources.office_service, { id })}
        addLabel="Add service"
        items={services.map((s) => item(locale, resources.office_service, s, docName.get(String(s.document_id)) ?? "Document"))}
      />
      <LegalSection
        supabase={supabase}
        locale={locale}
        parent={resources.office}
        id={id}
        targetIds={[id, ...services.map((s) => String(s.id))]}
        labels={labels}
      />
    </>
  );
}

async function LegalSection({
  supabase,
  locale,
  parent,
  id,
  targetIds,
  labels,
}: {
  supabase: SupabaseClient;
  locale: string;
  parent: ResourceDef;
  id: string;
  targetIds: string[];
  labels: Record<string, string>;
}) {
  const [refs, events] = await Promise.all([listLegalReferences(supabase, targetIds), auditTrail(supabase, targetIds)]);
  const allLabels: Record<string, string> = { ...labels };
  for (const r of refs) allLabels[String(r.id)] = `Legal reference: ${String(r.citation_title)}`;
  const moreEvents = await auditTrail(supabase, refs.map((r) => String(r.id)));
  const allEvents = [...events, ...moreEvents]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 50);

  return (
    <>
      <ChildSection
        title="Legal basis (Bakit ganito?)"
        description="Laws and issuances behind this record and its requirements. Only official sources (ranks 1 to 4) are allowed."
        addHref={newRecordPath(locale, resources.legal_reference, { id, type: parent.key })}
        addLabel="Add legal reference"
        items={refs.map((r) =>
          item(
            locale,
            resources.legal_reference,
            r,
            [r.issuance_number, r.citation_title].filter(Boolean).join(", "),
            labels[String(r.target_id)] && String(r.target_id) !== id ? `for ${labels[String(r.target_id)]}` : undefined,
          ),
        )}
      />
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-bold">History</h2>
        <AuditTrail events={allEvents} labels={allLabels} />
      </section>
    </>
  );
}
