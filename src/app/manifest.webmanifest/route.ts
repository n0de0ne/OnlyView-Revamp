import type { MetadataRoute } from "next";

/**
 * Public site's home-screen app. A route rather than `app/manifest.ts`: the
 * file convention links itself on every page, admin included, and would
 * override the admin's own manifest (see manifest-admin.webmanifest).
 */
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    name: "Villa ONLY VIEW — St Barth",
    short_name: "ONLY VIEW",
    description:
      "Luxury 4-bedroom villa in Pointe Milou, Saint-Barthélemy. Book direct with the owner.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c141b",
    theme_color: "#0c141b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
