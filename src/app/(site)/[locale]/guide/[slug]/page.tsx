import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { getContent } from "@/lib/site-content";
import { breadcrumbJsonLd, jsonLd, organizationJsonLd, ownerJsonLd, pageMetadata, SITE_URL } from "@/lib/seo";
import { getGuide } from "@/lib/guides";
import { formatDate } from "@/lib/dates";
import { PageHero } from "@/components/site/PageHero";
import { FlightSearch } from "@/components/site/FlightSearch";
import { getMapPlaces, slugify } from "@/lib/map-places";

export const revalidate = 3600;

// articles live in the database (Admin → Guide): each renders on its first visit
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const [guide] = await Promise.all([getGuide(slug), getContent(locale)]);
  if (!guide) return {};
  const fr = locale === "fr";
  // the article's own <title>, without the "| Villa ONLY VIEW" suffix: the
  // query is "St Barth …", and engines cut titles at about 60 characters
  return pageMetadata({
    locale,
    path: `/guide/${slug}`,
    title: fr ? guide.meta.title.fr : guide.meta.title.en,
    description: fr ? guide.meta.description.fr : guide.meta.description.en,
    absoluteTitle: true,
    type: "article",
    image: "/media/photos/exterior/exterior-01.webp",
  });
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = await getContent(locale);
  const fr = locale === "fr";
  const guide = await getGuide(slug);
  if (!guide) notFound();

  // live pins, so places added in Admin → Carte get their chip too; a guide
  // reference matches a pin's slug or its (renamed) name
  const pins = new Map<string, { slug: string; name: string }>();
  for (const p of await getMapPlaces(locale)) {
    pins.set(slugify(p.name), p);
    pins.set(p.slug, p);
  }

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
    datePublished: guide.published,
    dateModified: guide.updated,
    ...(guide.links?.length ? { citation: guide.links.map((l) => l.url) } : {}),
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
        {/* dated and signed: engines rank fresh, attributed guides; readers trust them */}
        <p className="mb-10 text-xs uppercase tracking-[0.18em] text-ink/45">
          {t.guideHub.updated}{" "}
          <time dateTime={guide.updated}>{formatDate(guide.updated, locale, { month: "long", year: "numeric" })}</time>
          {" · "}
          {t.guideHub.byline}
        </p>
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
                  .map((ref) => pins.get(ref))
                  .filter((p) => p !== undefined)
                  .map((p) => (
                    <Link
                      key={p.slug}
                      href={`${localePath(locale, "/map")}#${p.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1 text-ink/80 transition hover:border-gold hover:text-ink"
                    >
                      <MapPin aria-hidden className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                      {p.name}
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
        {guide.links && guide.links.length > 0 && (
          <section className="mb-12 border-t border-ink/10 pt-8" aria-labelledby="guide-links">
            <h2 id="guide-links" className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">
              {t.guideHub.linksTitle}
            </h2>
            <ul className="space-y-1.5 text-sm">
              {guide.links.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-navy underline decoration-gold/50 underline-offset-4 hover:text-gold"
                  >
                    {fr ? l.label.fr : l.label.en}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
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
