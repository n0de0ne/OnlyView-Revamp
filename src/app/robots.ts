import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/account", "/contracts/"],
      },
      // GEO: welcome AI crawlers explicitly (content is our marketing)
      { userAgent: "GPTBot", allow: "/", disallow: ["/admin", "/account"] },
      { userAgent: "ClaudeBot", allow: "/", disallow: ["/admin", "/account"] },
      { userAgent: "PerplexityBot", allow: "/", disallow: ["/admin", "/account"] },
      { userAgent: "Google-Extended", allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
