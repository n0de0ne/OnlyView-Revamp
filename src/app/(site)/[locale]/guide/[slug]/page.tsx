import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale, localePath, LOCALES, type Locale } from "@/lib/i18n";
import { altLanguages, breadcrumbJsonLd, jsonLd, SITE_URL } from "@/lib/seo";
import { GUIDES, getGuide } from "@/data/guides";
import { PageHero } from "@/components/site/PageHero";

export const revalidate = 3600;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => GUIDES.map((g) => ({ locale, slug: g.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const fr = locale === "fr";
  return {
    title: fr ? guide.title.fr : guide.title.en,
    description: fr ? guide.description.fr : guide.description.en,
    alternates: altLanguages(`/guide/${slug}`),
  };
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
    author: { "@type": "Organization", name: "Villa ONLY VIEW" },
    publisher: { "@type": "Organization", name: "Villa ONLY VIEW", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}${fr ? "/fr" : ""}/guide/${slug}`,
    about: { "@id": `${SITE_URL}/#villa` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            article,
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
