import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor, type Messages } from "@/i18n/dictionaries";
import { getPlannerCatalog } from "@/lib/content/public";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { MyDocumentRow } from "@/components/me/my-document-row";

export async function generateMetadata(props: PageProps<"/[locale]/my-documents">): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getDictionaryFor(isLocale(locale) ? locale : "en");
  return { title: t.myDocuments.title, robots: { index: false, follow: false } };
}

export default async function MyDocumentsPage(props: PageProps<"/[locale]/my-documents">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionaryFor(locale);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.myDocuments.title}</h1>
      <p>{t.myDocuments.intro}</p>
      <Suspense fallback={<p className="text-muted-foreground">{t.brand.loading}</p>}>
        <Rows locale={locale} t={t} />
      </Suspense>
    </div>
  );
}

async function Rows({ locale, t }: { locale: string; t: Messages }) {
  const user = await getCurrentUserClaims();
  if (!user) redirect(`/${locale}/login`);
  const [catalog, supabase] = await Promise.all([getPlannerCatalog(), createSupabaseServerClient()]);
  const { data } = supabase ? await supabase.from("user_documents").select("document_id, status, expires_on") : { data: [] };
  const mine = new Map(((data ?? []) as { document_id: string; status: string; expires_on: string | null }[]).map((r) => [r.document_id, r]));
  if (catalog.documents.length === 0) return <p className="rounded-lg border border-dashed p-6 text-muted-foreground">{t.myDocuments.empty}</p>;
  return (
    <ul className="space-y-3">
      {catalog.documents.map((d) => {
        const row = mine.get(d.id);
        return (
          <li key={d.id}>
            <MyDocumentRow
              locale={locale}
              document={{ id: d.id, name: d.name }}
              status={(row?.status as "have" | "in_progress" | "need" | undefined) ?? "none"}
              expiresOn={row?.expires_on ?? null}
              t={t.myDocuments}
            />
          </li>
        );
      })}
    </ul>
  );
}
