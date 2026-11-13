import type { NextConfig } from "next";

/**
 * Security headers (Phase 11). CSP notes:
 *  - script-src needs 'unsafe-inline' for Next's inline bootstrap and the
 *    pre-paint theme script on statically prerendered pages (nonces require
 *    dynamic rendering of every page). External scripts are still blocked.
 *  - img-src allows OpenStreetMap tiles (office map); replace with your
 *    commercial tile host before launch.
 *  - connect-src allows Supabase (auth, data, realtime).
 *  - form-action allows PayMongo checkout (no-JS checkout redirect) and Google sign-in.
 */
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
const dev = process.env.NODE_ENV !== "production";
// Only on HTTPS deployments: on http://localhost it would rewrite asset URLs to https and break local testing.
const https = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} https://*.supabase.co wss://*.supabase.co`.trim(),
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self' https://*.paymongo.com https://accounts.google.com https://*.supabase.co",
  "base-uri 'self'",
  "object-src 'none'",
  ...(https ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must always be re-checked so updates reach phones quickly.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
    ];
  },
};

export default nextConfig;
