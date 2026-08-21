import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { GUIDES } from "@/data/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/villa", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/tour", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/gallery", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/rates", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/booking", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/reviews", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/location", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/why-book-direct", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.6, changeFrequency: "yearly" as const },
    { path: "/guide", priority: 0.7, changeFrequency: "monthly" as const },
    ...GUIDES.map((g) => ({
      path: `/guide/${g.slug}`,
      priority: 0.6,
      changeFrequency: "monthly" as const,
    })),
  ];

  const now = new Date();
  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path || "/"}`,
    lastModified: now,
    changeFrequency,
    priority,
    alternates: {
      languages: {
        en: `${SITE_URL}${path || "/"}`,
        fr: `${SITE_URL}/fr${path}`,
      },
    },
  }));
}
