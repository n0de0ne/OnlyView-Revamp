import type { Metadata } from "next";
import Link from "next/link";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { getContent } from "@/lib/site-content";
import { breadcrumbJsonLd, itemListJsonLd, jsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { getGuides } from "@/lib/guides";
import { PageHero } from "@/components/site/PageHero";
import { KeyFacts } from "@/components/site/KeyFacts";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = await getContent(locale);
  return pageMetadata({
    locale,
    path: "/guide",
    title: t.meta.titleGuide,
    description: t.meta.descGuide,
    image: "/media/photos/exterior/exterior-01.webp",
  });
}

export default async function GuideIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const [t, GUIDES] = await Promise.all([getContent(locale), getGuides()]);
  const fr = locale === "fr";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            webPageJsonLd({
              locale,
              path: "/guide",
              name: fr ? "Guide St Barth" : "St Barth Guide",
              description: t.guideIntro,
              type: "CollectionPage",
            }),
            itemListJsonLd([
              {
                name: t.meta.titleLocation,
                url: localePath(locale, "/pointe-milou"),
                description: t.meta.descLocation,
              },
              { name: t.meta.titleMap, url: localePath(locale, "/map"), description: t.meta.descMap },
              ...GUIDES.map((g) => ({
                name: fr ? g.title.fr : g.title.en,
                url: localePath(locale, `/guide/${g.slug}`),
                description: fr ? g.description.fr : g.description.en,
              })),
            ]),
            breadcrumbJsonLd([
              { name: t.nav.home, url: fr ? "/fr" : "/" },
              { name: t.nav.guide, url: localePath(locale, "/guide") },
            ]),
          ]),
        }}
      />
      <PageHero
        eyebrow={t.nav.guide}
        title={fr ? "Guide St Barth" : "St Barth Guide"}
        intro={t.guideIntro}
      />
      {/* the island in eleven lines — the block an answer engine quotes for "St Barth guide" */}
      <KeyFacts
        title={t.guideHub.factsTitle}
        label={t.guideHub.factsLabel}
        summary={t.guideHub.facts.slice(0, 4).map(([, d]) => d).join(" · ")}
        toggle={t.seo.factsToggle}
        facts={Object.fromEntries(t.guideHub.facts.map(([term, detail], i) => [String(i), [term, detail]]))}
        className="border-b border-ink/10"
      />
      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <Link
            href={localePath(locale, "/pointe-milou")}
            className="group border border-gold/50 bg-sand p-8 transition hover:border-gold"
          >
            <p className="eyebrow mb-3">{t.pointeMilou.label}</p>
            <h2 className="font-display text-2xl leading-snug transition group-hover:text-gold">
              {t.guideHub.pointeMilouCard}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/65">{t.guideHub.pointeMilouText}</p>
            <span className="mt-5 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {t.common.readMore} →
            </span>
          </Link>
          <Link
            href={localePath(locale, "/map")}
            className="group border border-gold/50 bg-sand p-8 transition hover:border-gold"
          >
            <p className="eyebrow mb-3">{t.map.label}</p>
            <h2 className="font-display text-2xl leading-snug transition group-hover:text-gold">
              {fr ? "Carte interactive de l'île" : "Interactive island map"}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/65">{t.map.directoryIntro}</p>
            <span className="mt-5 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {t.nav.map} →
            </span>
          </Link>
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
