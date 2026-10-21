import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { CONTENT_UPDATED } from "@/lib/site-facts";
import { GUIDES } from "@/data/guides";
import manifest from "@/data/photos.json";

/** the first photo of a category, as an absolute URL */
const photo = (category: string) => {
  const p = (manifest as Array<{ category: string; url: string }>).find((x) => x.category === category);
  return p ? `${SITE_URL}${p.url}` : null;
};

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<{
    path: string;
    priority: number;
    changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
    images?: string[];
  }> = [
    { path: "", priority: 1.0, changeFrequency: "weekly", images: ["pool-terrace", "living", "night"] },
    { path: "/villa", priority: 0.9, changeFrequency: "monthly", images: ["exterior", "living", "bedroom1", "kitchen"] },
    { path: "/tour", priority: 0.8, changeFrequency: "monthly", images: ["living", "pool-terrace"] },
    { path: "/gallery", priority: 0.8, changeFrequency: "monthly", images: ["pool-terrace", "living", "bedroom1", "night", "exterior"] },
    { path: "/rates", priority: 0.9, changeFrequency: "weekly" },
    { path: "/booking", priority: 1.0, changeFrequency: "daily" },
    { path: "/reviews", priority: 0.7, changeFrequency: "weekly" },
    { path: "/location", priority: 0.8, changeFrequency: "monthly", images: ["exterior", "night"] },
    { path: "/map", priority: 0.8, changeFrequency: "monthly", images: ["exterior"] },
    { path: "/why-book-direct", priority: 0.7, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
    { path: "/guide", priority: 0.7, changeFrequency: "monthly" },
    ...GUIDES.map((g) => ({
      path: `/guide/${g.slug}`,
      priority: 0.6,
      changeFrequency: "monthly" as const,
    })),
  ];

  const lastModified = new Date(CONTENT_UPDATED);
  const entries: MetadataRoute.Sitemap = [];
  for (const { path, priority, changeFrequency, images } of pages) {
    const imgs = (images ?? []).map(photo).filter((u): u is string => !!u);
    const en = `${SITE_URL}${path || "/"}`;
    const fr = `${SITE_URL}/fr${path}`;
    const alternates = { languages: { en, fr, "x-default": en } };
    // one entry per language: each URL is a page of its own with its own
    // hreflang set, which is how Google wants bilingual sites listed
    entries.push({ url: en, lastModified, changeFrequency, priority, alternates, ...(imgs.length ? { images: imgs } : {}) });
    entries.push({ url: fr, lastModified, changeFrequency, priority, alternates, ...(imgs.length ? { images: imgs } : {}) });
  }
  return entries;
}
