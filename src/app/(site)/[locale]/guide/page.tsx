import type { Metadata } from "next";
import Link from "next/link";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { altLanguages } from "@/lib/seo";
import { GUIDES } from "@/data/guides";
import { PageHero } from "@/components/site/PageHero";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale === "fr";
  return {
    title: fr ? "Guide St Barth" : "St Barth Guide",
    description: fr
      ? "Le guide St Barth de la Villa ONLY VIEW : venir sur l'île, les plus belles plages, où manger, quelle saison choisir."
      : "Villa ONLY VIEW's St Barth guide: getting to the island, the best beaches, where to eat, and which season to choose.",
    alternates: altLanguages("/guide"),
  };
}

export default async function GuideIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const fr = locale === "fr";

  return (
    <>
      <PageHero
        eyebrow={t.nav.guide}
        title={fr ? "Guide St Barth" : "St Barth Guide"}
        intro={
          fr
            ? "Nos conseils d'initiés, écrits depuis la terrasse : l'essentiel pour préparer votre séjour."
            : "Insider notes written from the terrace: the essentials to plan your stay."
        }
      />
      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={localePath(locale, `/guide/${g.slug}`)}
              className="group border border-ink/10 bg-white p-8 transition hover:border-gold"
            >
              <p className="eyebrow mb-3">
                {g.category === "practical"
                  ? fr
                    ? "Pratique"
                    : "Practical"
                  : fr
                    ? "L'île"
                    : "The island"}
              </p>
              <h2 className="font-display text-2xl leading-snug transition group-hover:text-gold">
                {fr ? g.title.fr : g.title.en}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">
                {fr ? g.description.fr : g.description.en}
              </p>
              <span className="mt-5 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {t.common.readMore} →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
