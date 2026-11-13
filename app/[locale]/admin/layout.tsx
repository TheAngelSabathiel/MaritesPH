import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminMessages } from "@/components/admin/messages";

// Internal tool: never indexed. English-only by design (see README).
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout(props: LayoutProps<"/[locale]/admin">) {
  const { locale } = await props.params;
  return (
    <div className="space-y-5" lang="en">
      <p className="text-sm font-semibold text-muted-foreground">Marites PH admin</p>
      <AdminNav locale={locale} />
      <Suspense fallback={null}>
        <AdminMessages />
      </Suspense>
      {props.children}
    </div>
  );
}
