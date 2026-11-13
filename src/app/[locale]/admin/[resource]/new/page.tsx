import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getRecord, referenceOptions, requireAdmin, targetOptions, type Option } from "@/lib/admin/data";
import { adminPath, recordPath } from "@/lib/admin/paths";
import { resourceBySlug, resources, type ResourceKey } from "@/lib/admin/resources";
import { AdminLoading } from "@/components/admin/loading";
import { RecordForm } from "@/components/admin/record-form";

type Props = PageProps<"/[locale]/admin/[resource]/new">;

export default function NewRecordPage(props: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <NewRecord {...props} />
    </Suspense>
  );
}

async function NewRecord({ params, searchParams }: Props) {
  const { locale, resource: slug } = await params;
  const resource = resourceBySlug(slug);
  if (!resource) notFound();
  const { supabase } = await requireAdmin(locale);
  const sp = await searchParams;
  const parentId = typeof sp.parent === "string" ? sp.parent : undefined;

  // Child resources need an existing parent.
  let backHref = resource.topLevel ? adminPath(locale, resource.slug) : adminPath(locale);
  let context = "";
  const options: Record<string, Option[]> = {};
  const defaults: Record<string, unknown> = {};

  if (resource.parent) {
    const parentResource = resources[resource.parent.resource];
    const parent = parentId ? await getRecord(supabase, parentResource, parentId) : null;
    if (!parent) notFound();
    backHref = recordPath(locale, parentResource, parentId!);
    context = ` for ${String(parent[parentResource.labelColumn])}`;
  }

  if (resource.polymorphicParent) {
    const parentType = typeof sp.parent_type === "string" ? sp.parent_type : "";
    const parentResource = resources[parentType as ResourceKey];
    const parent = parentResource && parentId ? await getRecord(supabase, parentResource, parentId) : null;
    if (!parentResource || !parent) notFound();
    backHref = recordPath(locale, parentResource, parentId!);
    context = ` for ${String(parent[parentResource.labelColumn])}`;
    options.target = await targetOptions(supabase, parentType, parentId!);
    defaults.target_type = parentType;
    defaults.target_id = parentId;
  }

  for (const field of resource.fields) {
    if (field.kind === "reference" && field.references) options[field.name] = await referenceOptions(supabase, field.references);
  }
  if (resource.key === "document_requirement") {
    defaults.option_key = "a";
    defaults.quantity = 1;
  }

  return (
    <section className="space-y-4">
      <Link href={backHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">
        Back
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight">
        New {resource.singular.toLowerCase()}
        {context}
      </h1>
      <p className="text-sm text-muted-foreground">New records start as drafts and are never public until verified and published.</p>
      <RecordForm
        resource={resource}
        locale={locale}
        values={defaults}
        options={options}
        parentValue={parentId}
        showReverify={false}
      />
    </section>
  );
}
