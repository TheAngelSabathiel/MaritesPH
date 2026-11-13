import Link from "next/link";
// Site-wide links don't prefetch: on low-end phones, prefetching a dozen pages competes with first interaction.
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";

/** Footer with the non-affiliation and anti-fixer statements on every page. */
export function SiteFooter({ locale, t }: { locale: Locale; t: Messages }) {
  return (
    <footer className="safe-bottom mt-16 border-t bg-card">
      <div className="safe-x mx-auto max-w-5xl space-y-3 py-8 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">{t.footer.notAffiliated}</p>
        <p>{t.footer.noFixers}</p>
        <nav aria-label={t.footer.legalNav} className="flex flex-wrap gap-x-1 pt-2">
          <Link prefetch={false} href={`/${locale}/legal/privacy`} className="inline-flex min-h-11 items-center px-2 underline underline-offset-2">
            {t.footer.privacy}
          </Link>
          <Link prefetch={false} href={`/${locale}/legal/terms`} className="inline-flex min-h-11 items-center px-2 underline underline-offset-2">
            {t.footer.terms}
          </Link>
          <Link prefetch={false} href={`/${locale}/legal/disclaimer`} className="inline-flex min-h-11 items-center px-2 underline underline-offset-2">
            {t.footer.disclaimer}
          </Link>
        </nav>
        <p className="pt-2">{t.meta.tagline}</p>
      </div>
    </footer>
  );
}
