"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { LOCALE_COOKIE, switchLocalePath, type Locale } from "@/i18n/config";

type Props = { target: Locale; label: string; shortLabel: string; ariaLabel: string };

/**
 * Link to the same page in the other language; remembers the choice in a cookie.
 * Reading the current path must happen inside Suspense on dynamic routes; until
 * then the link points at the other language's home page.
 * Shows a short code (FIL/EN) on very narrow phones, the full name from sm up.
 */
export function LocaleSwitcher(props: Props) {
  return (
    <Suspense fallback={<SwitchLink {...props} href={`/${props.target}`} />}>
      <CurrentPathSwitch {...props} />
    </Suspense>
  );
}

function CurrentPathSwitch(props: Props) {
  const pathname = usePathname() ?? "/";
  return <SwitchLink {...props} href={switchLocalePath(pathname, props.target)} />;
}

function SwitchLink({ target, label, shortLabel, ariaLabel, href }: Props & { href: string }) {
  return (
    <Link
      href={href}
      hrefLang={target}
      aria-label={ariaLabel}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
      }}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm font-semibold hover:bg-muted sm:px-3"
    >
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
