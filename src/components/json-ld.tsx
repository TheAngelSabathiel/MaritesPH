import { jsonLdString } from "@/lib/seo/structured-data";

/** Renders schema.org structured data. Content is escaped against </script> injection. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
