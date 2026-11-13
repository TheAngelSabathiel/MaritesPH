"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

function items(locale: string) {
  const base = `/${locale}/admin`;
  return [
    { href: base, label: "Dashboard", exact: true },
    { href: `${base}/queue`, label: "Verify queue" },
    { href: `${base}/stale`, label: "Stale" },
    { href: `${base}/flags`, label: "Flags" },
    { href: `${base}/tips`, label: "Tips" },
    { href: `${base}/bantay-batas`, label: "Bantay Batas" },
    { href: `${base}/source-health`, label: "Source health" },
    { href: `${base}/signals`, label: "Signals" },
    { href: `${base}/billing`, label: "Billing" },
    { href: `${base}/marketplace`, label: "Marketplace" },
    { href: `${base}/documents`, label: "Documents" },
    { href: `${base}/offices`, label: "Offices" },
    { href: `${base}/agencies`, label: "Agencies" },
    { href: `${base}/tax-rules`, label: "Tax rules" },
    { href: `${base}/tax-deadlines`, label: "Tax deadlines" },
    { href: `${base}/lgu-processes`, label: "LGU processes" },
    { href: `${base}/sources`, label: "Sources" },
  ];
}

/**
 * Admin section nav. On phones it is one horizontally scrollable row (no
 * wrapping into a tall block). The active-tab highlight needs the current
 * URL, which on dynamic routes must load inside Suspense; the fallback is the
 * same nav without a highlight, so links work immediately.
 */
export function AdminNav({ locale }: { locale: string }) {
  return (
    <Suspense fallback={<NavLinks locale={locale} pathname="" />}>
      <ActiveNav locale={locale} />
    </Suspense>
  );
}

function ActiveNav({ locale }: { locale: string }) {
  return <NavLinks locale={locale} pathname={usePathname() ?? ""} />;
}

function NavLinks({ locale, pathname }: { locale: string; pathname: string }) {
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex w-max gap-1 border-b">
        {items(locale).map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
