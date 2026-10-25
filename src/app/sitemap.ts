import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { CONTENT_UPDATED } from "@/lib/site-facts";
import { GUIDES } from "@/data/guides";
import { prisma } from "@/lib/db";
import manifest from "@/data/photos.json";

export const revalidate = 3600;

/** the first photo of a category, as an absolute URL */
const photo = (category: string) => {
  const p = (manifest as Array<{ category: string; url: string }>).find((x) => x.category === category);
  return p ? `${SITE_URL}${p.url}` : null;
};

/** when the reviews page last gained a review — its real lastmod */
async function latestReviewDate(): Promise<Date | null> {
  try {
    const r = await prisma.testimonial.findFirst({
      where: { isApproved: true },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return r?.createdAt ?? null;
  } catch {
    return null; // no database at build time
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = new Date(CONTENT_UPDATED);
  const latestReview = await latestReviewDate();
  const newer = (a: Date, b: Date | null) => (b && b > a ? b : a);

  const pages: Array<{
    path: string;
    priority: number;
    changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
    lastModified?: Date;
    images?: string[];
  }> = [
    { path: "", priority: 1.0, changeFrequency: "weekly", images: ["pool-terrace", "living", "night"], lastModified: newer(content, latestReview) },
    { path: "/villa", priority: 0.9, changeFrequency: "monthly", images: ["exterior", "living", "bedroom1", "kitchen"] },
    { path: "/tour", priority: 0.8, changeFrequency: "monthly", images: ["living", "pool-terrace"] },
    { path: "/gallery", priority: 0.8, changeFrequency: "monthly", images: ["pool-terrace", "living", "bedroom1", "night", "exterior"] },
    { path: "/rates", priority: 0.9, changeFrequency: "weekly" },
    { path: "/booking", priority: 1.0, changeFrequency: "daily", lastModified: new Date() },
    { path: "/reviews", priority: 0.7, changeFrequency: "weekly", lastModified: newer(content, latestReview) },
    // the neighbourhood page: the query "villa Pointe Milou" lands here
    { path: "/pointe-milou", priority: 0.9, changeFrequency: "monthly", images: ["night", "exterior", "pool-terrace"] },
    { path: "/map", priority: 0.8, changeFrequency: "monthly", images: ["exterior"] },
    { path: "/why-book-direct", priority: 0.7, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
    { path: "/guide", priority: 0.8, changeFrequency: "monthly", lastModified: new Date(GUIDES.map((g) => g.updated).sort().at(-1) ?? CONTENT_UPDATED) },
    ...GUIDES.map((g) => ({
      path: `/guide/${g.slug}`,
      priority: 0.7,
      changeFrequency: "monthly" as const,
      lastModified: new Date(g.updated),
    })),
  ];

  const entries: MetadataRoute.Sitemap = [];
  for (const { path, priority, changeFrequency, images, lastModified } of pages) {
    const imgs = (images ?? []).map(photo).filter((u): u is string => !!u);
    const en = `${SITE_URL}${path || "/"}`;
    const fr = `${SITE_URL}/fr${path}`;
    const alternates = { languages: { en, fr, "x-default": en } };
    const lastmod = lastModified ?? content;
    // one entry per language: each URL is a page of its own with its own
    // hreflang set, which is how Google wants bilingual sites listed
    entries.push({ url: en, lastModified: lastmod, changeFrequency, priority, alternates, ...(imgs.length ? { images: imgs } : {}) });
    entries.push({ url: fr, lastModified: lastmod, changeFrequency, priority, alternates, ...(imgs.length ? { images: imgs } : {}) });
  }
  return entries;
}
