/** robots.txt: index public pages; keep private and internal pages out. */
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/*/admin", "/*/account", "/*/login", "/*/ui-preview", "/auth/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
