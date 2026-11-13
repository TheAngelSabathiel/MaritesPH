import type { MetadataRoute } from "next";

/** Web app manifest: installable on Android home screens; opens to the chosen language. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Marites PH",
    short_name: "Marites PH",
    description: "Verified, step-by-step guides for Philippine government paperwork.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f3ea",
    theme_color: "#1d3a72",
    lang: "en-PH",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
