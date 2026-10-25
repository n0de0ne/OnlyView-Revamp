import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale, localePath, LOCALES, type Locale } from "@/lib/i18n";
import { breadcrumbJsonLd, jsonLd, organizationJsonLd, ownerJsonLd, pageMetadata, SITE_URL } from "@/lib/seo";
import { CONTENT_UPDATED } from "@/lib/site-facts";
import { GUIDES, getGuide } from "@/data/guides";
import { PageHero } from "@/components/site/PageHero";
import { FlightSearch } from "@/components/site/FlightSearch";
import mapPlaces from "@/data/map-places.json";

const PLACE_NAMES = new Map(mapPlaces.map((p) => [p.slug, p.name]));

export const revalidate = 3600;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => GUIDES.map((g) => ({ locale, slug: g.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const guide = getGuide(slug);
  if (!guide) return {};
  const fr = locale === "fr";
  return pageMetadata({
    locale,
    path: `/guide/${slug}`,
    title: fr ? guide.title.fr : guide.title.en,
    description: fr ? guide.description.fr : guide.description.en,
    type: "article",
  });
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const fr = locale === "fr";
  const guide = getGuide(slug);
  if (!guide) notFound();

  const title = fr ? guide.title.fr : guide.title.en;
  const sections = fr ? guide.sections.fr : guide.sections.en;

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: fr ? guide.description.fr : guide.description.en,
    author: { "@id": `${SITE_URL}/#owner` },
    publisher: { "@id": `${SITE_URL}/#org` },
    mainEntityOfPage: `${SITE_URL}${fr ? "/fr" : ""}/guide/${slug}`,
    image: [`${SITE_URL}/media/photos/exterior/exterior-01.webp`],
    inLanguage: fr ? "fr-FR" : "en-US",
    datePublished: "2025-11-01",
    dateModified: CONTENT_UPDATED,
    about: { "@id": `${SITE_URL}/#villa` },
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            article,
            ownerJsonLd(locale),
            organizationJsonLd(),
            breadcrumbJsonLd([
              { name: t.nav.home, url: fr ? "/fr" : "/" },
              { name: t.nav.guide, url: localePath(locale, "/guide") },
              { name: title, url: localePath(locale, `/guide/${slug}`) },
            ]),
          ]),
        }}
      />
      <PageHero eyebrow={t.nav.guide} title={title} intro={fr ? guide.description.fr : guide.description.en} />
      <article className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
        {sections.map((s, i) => (
          <section key={i} className="mb-12">
            <h2 className="font-display mb-4 text-3xl text-ink">{s.h}</h2>
            {s.p.map((p, j) => (
              <p key={j} className="mb-4 leading-relaxed text-ink/75">
                {p}
              </p>
            ))}
            {s.places && s.places.length > 0 && (
              <p className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink/50">
                  {fr ? "Sur la carte" : "On the map"}
                </span>
                {s.places
                  .filter((slug) => PLACE_NAMES.has(slug))
                  .map((slug) => (
                    <Link
                      key={slug}
                      href={`${localePath(locale, "/map")}#${slug}`}
                      className="rounded-full border border-ink/15 px-3 py-1 text-ink/80 transition hover:border-gold hover:text-ink"
                    >
                      📍 {PLACE_NAMES.get(slug)}
                    </Link>
                  ))}
              </p>
            )}
            {s.flightSearch && (
              <div className="mt-8">
                <FlightSearch locale={locale} />
              </div>
            )}
          </section>
        ))}
        <div className="border-t border-ink/10 pt-10 text-center">
          <p className="mb-5 font-display text-2xl italic text-ink/70">
            “{t.footer.tagline}”
          </p>
          <Link href={localePath(locale, "/booking")} className="btn-gold">
            {t.hero.cta}
          </Link>
        </div>
      </article>
    </>
  );
}
