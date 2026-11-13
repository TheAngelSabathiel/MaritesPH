import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { hreflang, isLocale, locales } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { publicEnv } from "@/lib/env";
import { localizedAlternates } from "@/lib/seo/metadata";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeScript } from "@/components/theme";
import { ServiceWorkerRegistration } from "@/components/pwa/register";
import { Analytics } from "@vercel/analytics/next";

// Pre-render both language versions. Required for root params with Cache Components.
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw edge to edge on notched phones; content is kept clear of the
  // notch and home indicator with safe-area padding (see globals.css).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#162036" },
  ],
};

export async function generateMetadata(props: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionaryFor(locale);
  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: t.meta.defaultTitle, template: `%s | ${t.meta.siteName}` },
    description: t.meta.defaultDescription,
    applicationName: t.meta.siteName,
    alternates: localizedAlternates(locale, ""),
    openGraph: {
      siteName: t.meta.siteName,
      locale: hreflang[locale].replace("-", "_"),
      type: "website",
    },
  };
}

export default async function LocaleLayout(props: LayoutProps<"/[locale]">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionaryFor(locale);

  return (
    <html lang={hreflang[locale]} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-3 focus:font-semibold"
        >
          {t.nav.skipToContent}
        </a>
        <SiteHeader locale={locale} t={t} />
        <main id="main" className="safe-x mx-auto w-full max-w-5xl flex-1 py-6 sm:py-8">
          {props.children}
        </main>
        <SiteFooter locale={locale} t={t} />
        <ServiceWorkerRegistration />
        {/* Cookieless, aggregate page views (no personal data); on only when NEXT_PUBLIC_ANALYTICS=vercel. */}
        {process.env.NEXT_PUBLIC_ANALYTICS === "vercel" ? <Analytics /> : null}
      </body>
    </html>
  );
}
