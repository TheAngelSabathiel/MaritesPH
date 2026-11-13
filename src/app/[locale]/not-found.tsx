import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="space-y-4 py-12">
      <p className="font-semibold text-muted-foreground">{t.brand.notFound}</p>
      <h1 className="text-3xl font-extrabold tracking-tight">{t.errors.notFoundTitle}</h1>
      <p className="max-w-prose">{t.errors.notFoundBody}</p>
      <Link href={`/${locale}`} className={buttonVariants()}>
        {t.errors.backHome}
      </Link>
    </div>
  );
}
