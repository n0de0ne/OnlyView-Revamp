import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
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
}
