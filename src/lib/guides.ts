import "server-only";
import type { GuideArticle as GuideRow } from "@prisma/client";
import { prisma } from "./db";
import { GUIDES, type GuideArticle, type GuideLink, type GuideSection } from "@/data/guides";

export type { GuideArticle, GuideLink, GuideSection };

/**
 * St Barth guide articles, stored in the database (Admin → Guide).
 * `data/guides.ts` only holds the six articles the table was first filled
 * with (`seedGuides`, once per database).
 */
export { GUIDE_CATEGORIES } from "./admin-schemas";

/** The pages that quote the articles (the sitemap and llms files are read live). */
export const GUIDE_PATHS: Array<[string, "page" | "layout"]> = [
  ["/(site)/[locale]/guide", "page"],
  ["/(site)/[locale]/guide/[slug]", "page"],
];

type Bi = { en: string; fr: string };
const bi = (v: unknown): Bi => {
  const o = (v ?? {}) as Partial<Bi>;
  return { en: o.en ?? "", fr: o.fr ?? "" };
};

export function rowToGuide(r: GuideRow): GuideArticle & { id: number; isPublished: boolean; sortOrder: number } {
  const sections = (r.sections ?? {}) as Partial<GuideArticle["sections"]>;
  return {
    id: r.id,
    isPublished: r.isPublished,
    sortOrder: r.sortOrder,
    slug: r.slug,
    category: r.category,
    title: bi(r.title),
    description: bi(r.description),
    published: r.publishedOn,
    updated: r.updatedOn,
    meta: { title: bi(r.metaTitle), description: bi(r.metaDescription) },
    sections: { en: sections.en ?? [], fr: sections.fr ?? [] },
    links: (r.links as unknown as GuideLink[]) ?? [],
  };
}

export function guideToData(g: GuideArticle, sortOrder: number) {
  return {
    slug: g.slug,
    category: g.category,
    sortOrder,
    publishedOn: g.published,
    updatedOn: g.updated,
    title: g.title,
    description: g.description,
    metaTitle: g.meta.title,
    metaDescription: g.meta.description,
    sections: g.sections as unknown as object,
    links: (g.links ?? []) as unknown as object,
  };
}

/** Published articles in the admin's order; the shipped ones when there is no database (image build). */
export async function getGuides(): Promise<GuideArticle[]> {
  try {
    const rows = await prisma.guideArticle.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return rows.map(rowToGuide);
  } catch {
    return GUIDES;
  }
}

export async function getGuide(slug: string): Promise<GuideArticle | undefined> {
  try {
    const row = await prisma.guideArticle.findUnique({ where: { slug } });
    return row?.isPublished ? rowToGuide(row) : undefined;
  } catch {
    return GUIDES.find((g) => g.slug === slug);
  }
}

const SEEDED = "guides_seeded";

/**
 * Fill the table with the shipped articles, once per database (a Setting row
 * marks it done): an article the owner deletes or renames stays that way.
 */
export async function seedGuides(): Promise<number> {
  if (await prisma.setting.findUnique({ where: { key: SEEDED } })) return 0;
  let added = 0;
  for (const [i, g] of GUIDES.entries()) {
    if (await prisma.guideArticle.findUnique({ where: { slug: g.slug } })) continue;
    await prisma.guideArticle.create({ data: guideToData(g, (i + 1) * 10) });
    added++;
  }
  await prisma.setting.create({ data: { key: SEEDED, value: new Date().toISOString() } });
  return added;
}
