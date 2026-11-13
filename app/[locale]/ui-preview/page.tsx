/**
 * UI preview: renders admin components with SAMPLE data so layouts can be
 * checked on phone widths (and by the mobile Playwright tests) without a
 * database or an admin login. Disabled unless ENABLE_UI_PREVIEW=true.
 * Never enable it in production: it is noindex, but it serves no purpose there.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { resources } from "@/lib/admin/resources";
import { AdminNav } from "@/components/admin/admin-nav";
import { ChildItems, ChildSection } from "@/components/admin/child-section";
import { IndexRows } from "@/components/admin/index-rows";
import { RecordForm } from "@/components/admin/record-form";
import { RecordList } from "@/components/admin/record-list";
import { WorkflowPanel } from "@/components/admin/workflow-panel";

export const metadata: Metadata = { title: "UI preview", robots: { index: false, follow: false } };

const NOW = new Date("2026-11-12T00:00:00Z");
const SAMPLE_URL = "https://example.gov.ph/a-rather-long-official-source-path/that-should-wrap-on-phones";

export default function UiPreviewPage(props: PageProps<"/[locale]/ui-preview">) {
  return (
    <Suspense fallback={null}>
      <Preview params={props.params} />
    </Suspense>
  );
}

async function Preview({ params }: { params: PageProps<"/[locale]/ui-preview">["params"] }) {
  await connection(); // read the flag at request time, not build time
  if (process.env.ENABLE_UI_PREVIEW !== "true") notFound();
  const { locale } = await params;
  const loc = locale === "fil" ? "fil" : "en";

  return (
    <div className="space-y-10" lang="en">
      <p className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
        UI preview with sample data. Nothing here is real government information.
      </p>

      <section className="space-y-3" data-preview="nav">
        <AdminNav locale={locale} />
      </section>

      <section className="space-y-3" data-preview="list">
        <h2 className="text-xl font-bold">Record list</h2>
        <RecordList
          now={NOW}
          staleDays={90}
          empty="Nothing"
          columnLabels={["Type", "URL slug"]}
          rows={[
            { id: "1", href: "#", label: "Sample ID with a fairly long name to test wrapping on small screens", status: "published", lastVerifiedAt: "2026-06-01T00:00:00Z", toVerify: false, columns: [{ label: "Type", value: "id" }, { label: "URL slug", value: "sample-id-with-a-fairly-long-slug" }] },
            { id: "2", href: "#", label: "Sample clearance", status: "draft", lastVerifiedAt: null, toVerify: true, columns: [{ label: "Type", value: "clearance" }, { label: "URL slug", value: "sample-clearance" }] },
            { id: "3", href: "#", label: "Sample certificate", status: "verified", lastVerifiedAt: "2026-11-01T00:00:00Z", toVerify: false, columns: [{ label: "Type", value: "certificate" }, { label: "URL slug", value: "sample-certificate" }] },
          ]}
        />
      </section>

      <section className="space-y-3" data-preview="workflow">
        <h2 className="text-xl font-bold">Workflow panel</h2>
        <WorkflowPanel
          resource={resources.document}
          id="00000000-0000-0000-0000-000000000000"
          locale={loc}
          state={{ status: "verified", source_url: SAMPLE_URL, last_verified_at: "2026-10-01T00:00:00Z", to_verify_note: "TO VERIFY: sample note that is long enough to wrap across several lines on a phone screen" }}
        />
      </section>

      <section className="space-y-3" data-preview="children">
        <ChildSection title="Requirements" description="Every group is required. Within a group, any one option is enough." addHref="#" addLabel="Add requirement">
          <ChildItems
            items={[
              { id: "r1", href: "#", label: "Sample requirement A", status: "published" },
              { id: "r2", href: "#", label: "Sample requirement B with a longer label that wraps", status: "draft", note: "TO VERIFY: sample" },
            ]}
          />
        </ChildSection>
      </section>

      <section className="space-y-3" data-preview="queue">
        <h2 className="text-xl font-bold">Queue rows</h2>
        <IndexRows
          locale={locale}
          empty="Nothing"
          rows={[{ target_type: "document_requirement", id: "x", label: "Sample document: sample requirement", parent_type: "document", parent_id: "y", status: "draft", to_verify_note: "TO VERIFY: sample" }]}
          detail={(r) => <p className="rounded-md bg-caution-soft px-3 py-2">{String(r.to_verify_note)}</p>}
        />
      </section>

      <section className="space-y-3" data-preview="office-form">
        <h2 className="text-xl font-bold">Office form (with hours editor)</h2>
        <RecordForm
          resource={resources.office}
          locale={locale}
          id="00000000-0000-0000-0000-000000000001"
          values={{
            name: "Sample office",
            region: "Sample region",
            lat: 14.6,
            lng: 121,
            hours: { mon: [["08:00", "12:00"], ["13:00", "17:00"]], sat: [["08:00", "12:00"]] },
            source_url: SAMPLE_URL,
          }}
          options={{ agency_id: [{ value: "a", label: "Sample agency" }] }}
          showReverify
        />
      </section>

      <section className="space-y-3" data-preview="document-form">
        <h2 className="text-xl font-bold">Document form</h2>
        <RecordForm
          resource={resources.document}
          locale={locale}
          values={{ name: "Sample ID", slug: "sample-id", type: "id", purpose_tags: ["valid_id"] }}
          options={{ agency_id: [{ value: "a", label: "Sample agency" }] }}
          showReverify={false}
        />
      </section>
    </div>
  );
}
