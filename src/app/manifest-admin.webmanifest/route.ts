import type { MetadataRoute } from "next";

/**
 * Home-screen app for the back office. Kept outside `/admin` so the session
 * gate never redirects it, and given its own id/scope so "Add to Home Screen"
 * from the admin opens the admin instead of the public site's start_url.
 */
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/admin",
    name: "ONLY VIEW — Admin",
    short_name: "OV Admin",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#12324a",
    theme_color: "#12324a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
