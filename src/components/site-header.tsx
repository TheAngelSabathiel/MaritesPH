/**
 * Site header: brand, language switcher, theme toggle, and the user menu.
 * Fits 360px screens in both languages (short language code below sm).
 */
import { Suspense } from "react";
import Link from "next/link";
// Site-wide links don't prefetch: on low-end phones, prefetching a dozen pages competes with first interaction.
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { BrandMark } from "./brand-mark";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme";
import { UserNav } from "./user-nav";

export function SiteHeader({ locale, t }: { locale: Locale; t: Messages }) {
  const other: Locale = locale === "en" ? "fil" : "en";
  return (
    <header className="safe-top border-b bg-card">
      <div className="safe-x mx-auto flex max-w-5xl items-center gap-1 py-2 sm:gap-2">
        <Link
          href={`/${locale}`}
          className="mr-auto inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md font-extrabold tracking-tight sm:gap-2"
        >
          <BrandMark className="size-7 shrink-0 sm:size-8" />
          <span className="truncate text-base sm:text-lg">{t.meta.siteName}</span>
        </Link>
        <nav aria-label={t.nav.mainNav} className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <LocaleSwitcher target={other} label={t.nav.switchTo} shortLabel={t.nav.switchToShort} ariaLabel={t.nav.switchToLabel} />
          <ThemeToggle label={t.nav.themeToggle} />
          {/* Reads the session cookie, so it streams in after the static shell. */}
          <Suspense fallback={<span className="inline-block min-h-11 w-20" aria-hidden="true" />}>
            <UserNav locale={locale} t={t} />
          </Suspense>
        </nav>
      </div>
      <nav aria-label={t.nav.sectionNav} className="border-t">
        <ul className="safe-x mx-auto flex max-w-5xl gap-1 overflow-x-auto">
          <li>
            <Link prefetch={false} href={`/${locale}/lakad`} className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-semibold text-primary hover:underline">
              {t.nav.planner}
            </Link>
          </li>
          <li>
            <Link prefetch={false} href={`/${locale}/cpas`} className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-semibold hover:text-primary">
              {t.nav.cpas}
            </Link>
          </li>
          <li>
            <Link prefetch={false} href={`/${locale}/negosyo`} className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-semibold hover:text-primary">
              {t.nav.negosyo}
            </Link>
          </li>
          <li>
            <Link prefetch={false} href={`/${locale}/pricing`} className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-semibold hover:text-primary">
              {t.nav.pricing}
            </Link>
          </li>
          <li>
            <Link prefetch={false} href={`/${locale}/freelancer`} className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-semibold hover:text-primary">
              {t.nav.freelancer}
            </Link>
          </li>
          <li>
            <Link prefetch={false} href={`/${locale}/ids`} className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-semibold hover:text-primary">
              {t.nav.guides}
            </Link>
          </li>
          <li>
            <Link prefetch={false} href={`/${locale}/chika`} className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-semibold hover:text-primary">
              {t.nav.chika}
            </Link>
          </li>
          <li>
            <Link prefetch={false} href={`/${locale}/ano-ng-bago`} className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-semibold hover:text-primary">
              {t.nav.feed}
            </Link>
          </li>
          <li>
            <Link prefetch={false} href={`/${locale}/offices`} className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-semibold hover:text-primary">
              {t.nav.offices}
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
