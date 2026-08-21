import { prisma } from "./db";
import manifest from "@/data/photos.json";

export interface SitePhoto {
  id: number;
  category: string;
  url: string;
  alt: string;
  width: number;
  height: number;
}

export const PHOTO_CATEGORIES = [
  "pool-terrace",
  "living",
  "kitchen",
  "bedroom1",
  "bedroom2",
  "bedroom3",
  "bedroom4",
  "night",
  "exterior",
] as const;

/**
 * Published photos, DB-first (admin-managed) with a static-manifest fallback
 * so the site renders even before the database is seeded (e.g. CI builds).
 */
export async function getPhotos(category?: string): Promise<SitePhoto[]> {
  try {
    const rows = await prisma.photo.findMany({
      where: { published: true, ...(category ? { category } : {}) },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        category: r.category,
        url: r.url,
        alt: r.alt ?? "Villa ONLY VIEW",
        width: r.width ?? 1800,
        height: r.height ?? 1200,
      }));
    }
  } catch {
    // DB unavailable — fall through to manifest
  }
  return (manifest as Array<{ category: string; url: string; width: number; height: number }>)
    .filter((p) => !category || p.category === category)
    .map((p, i) => ({
      id: i + 1,
      category: p.category,
      url: p.url,
      alt: `Villa ONLY VIEW — ${p.category}`,
      width: p.width,
      height: p.height,
    }));
}

export function firstOf(photos: SitePhoto[], category: string): SitePhoto | undefined {
  return photos.find((p) => p.category === category);
}
