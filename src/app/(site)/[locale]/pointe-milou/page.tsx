import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  jsonLd,
  pageMetadata,
  pointeMilouJsonLd,
  schemaImages,
  SITE_URL,
  vacationRentalJsonLd,
  webPageJsonLd,
} from "@/lib/seo";
import { VILLA } from "@/lib/site-facts";
import { getPhotos, firstOf } from "@/lib/photos";
import { getContact } from "@/lib/contact";
import { PageHero } from "@/components/site/PageHero";
import { GoldenHour } from "@/components/site/golden-hour/GoldenHour";

export const revalidate = 3600;

/**
 * /pointe-milou — the neighbourhood page. "Villa Pointe Milou" is the query
 * this site can own: one page that says what the place is, what is there,
 * why people choose it and which villa to rent, in plain paragraphs an
 * answer engine can lift whole. The old site had this URL too.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  return pageMetadata({
    locale,
    path: "/pointe-milou",
    title: t.meta.titleLocation,
    description: t.meta.descLocation,
    image: "/media/photos/night/night-01.webp",
    imageAlt: `${t.pointeMilou.title} — ${VILLA.name}`,
  });
}

export default async function PointeMilouPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const fr = locale === "fr";
  const pm = t.pointeMilou;
  const [photos, { mapUrl, sameAs }] = await Promise.all([getPhotos(), getContact()]);

  const distances = VILLA.distances.map((d) => [fr ? d.fr : d.en, `${d.minutes} min`] as [string, string]);
  const villaPhoto = firstOf(photos, "pool-terrace");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            webPageJsonLd({
              locale,
              path: "/pointe-milou",
              name: t.meta.titleLocation,
              description: t.meta.descLocation,
              about: { "@id": `${SITE_URL}/#pointe-milou` },
              datePublished: "2025-11-01",
            }),
            pointeMilouJsonLd(locale, pm.intro),
            vacationRentalJsonLd({ locale, images: schemaImages(photos), sameAs }),
            faqJsonLd(pm.faq),
            breadcrumbJsonLd([
              { name: t.nav.home, url: fr ? "/fr" : "/" },
              { name: pm.title, url: localePath(locale, "/pointe-milou") },
            ]),
          ]),
        }}
      />
      <PageHero eyebrow={pm.label} title={pm.title} intro={pm.intro} image={firstOf(photos, "night")} />

      {/* Why here — the reasons, with the honest one last */}
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24" aria-labelledby="pm-why">
        <p className="eyebrow mb-4">{pm.label}</p>
        <h2 id="pm-why" className="section-title mb-5">
          {pm.whyTitle}
        </h2>
        <p className="mb-10 max-w-3xl leading-relaxed text-ink/70">{pm.whyIntro}</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pm.why.map(([title, text], i) => (
            <div key={title} className="reveal border border-ink/10 bg-white p-7">
              <div className="font-display text-3xl text-gold/40">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="mt-2 font-display text-2xl text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The whole package — shops, hotels, tables, beaches, all close by.
          Same cards as "Why stay", numbered on from it. */}
      <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8 lg:pb-24" aria-labelledby="pm-package">
        <p className="eyebrow mb-4">{pm.packageLabel}</p>
        <h2 id="pm-package" className="section-title mb-5">
          {pm.packageTitle}
        </h2>
        <p className="mb-10 max-w-3xl leading-relaxed text-ink/70">{pm.packageIntro}</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pm.package.map(([title, text], i) => (
            <div key={title} className="reveal border border-ink/10 bg-white p-7">
              <div className="font-display text-3xl text-gold/40">{String(pm.why.length + i + 1).padStart(2, "0")}</div>
              <h3 className="mt-2 font-display text-2xl text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 max-w-3xl font-display text-2xl leading-snug text-ink">{pm.packageOutro}</p>
      </section>

      {/* What is there */}
      <section className="border-y border-ink/10 bg-white" aria-labelledby="pm-whats">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <h2 id="pm-whats" className="section-title mb-8 !text-3xl">
              {pm.whatsTitle}
            </h2>
            <dl className="divide-y divide-ink/10 border-y border-ink/10">
              {pm.whats.map(([term, detail]) => (
                <div key={term} className="py-4">
                  <dt className="font-semibold text-ink">{term}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink/70">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="section-title mb-8 !text-3xl">{pm.distancesTitle}</h2>
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {distances.map(([place, time]) => (
                <li key={place} className="flex items-center justify-between py-3.5 text-sm">
                  <span className="text-ink/80">{place}</span>
                  <span className="font-semibold text-gold">{time}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">
                Google Maps ↗
              </a>
              <Link href={localePath(locale, "/guide/getting-here")} className="btn-gold">
                {t.location.mapCta}
              </Link>
            </div>
            <Link
              href={localePath(locale, "/map")}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-gold"
            >
              🗺️ {t.location.islandMapCta} →
            </Link>
          </div>
        </div>
      </section>

      {/* The neighbourhood, named — the places people search for near here */}
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8" aria-labelledby="pm-nearby">
        <h2 id="pm-nearby" className="section-title mb-5 !text-3xl">
          {t.nearby.title}
        </h2>
        <p className="mb-10 max-w-3xl leading-relaxed text-ink/70">{t.nearby.intro}</p>
        <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {t.nearby.items.map(([place, detail]) => (
            <li key={place} className="border-t border-ink/10 pt-4">
              <span className="font-semibold text-ink">{place}</span>
              <span className="block text-sm text-ink/65">{detail}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* The villa in it */}
      <section className="bg-sand-dark py-16 lg:py-24" aria-labelledby="pm-villa">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2 lg:px-8">
          <div className="reveal">
            <p className="eyebrow mb-4">{VILLA.name}</p>
            <h2 id="pm-villa" className="section-title mb-6">
              {pm.villaTitle}
            </h2>
            <p className="max-w-xl leading-relaxed text-ink/70">{pm.villaText}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href={localePath(locale, "/villa")} className="btn-gold">
                {pm.villaCta}
              </Link>
              <Link href={localePath(locale, "/booking")} className="btn-outline">
                {t.hero.cta}
              </Link>
            </div>
          </div>
          {villaPhoto && (
            <Link href={localePath(locale, "/villa")} className="reveal block">
              <Image
                src={villaPhoto.url}
                alt={villaPhoto.alt}
                width={900}
                height={640}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="aspect-[4/3] w-full object-cover shadow-2xl shadow-ink/20"
              />
            </Link>
          )}
        </div>
      </section>

      {/* Questions people ask about the place */}
      <section className="mx-auto max-w-3xl px-5 py-16 lg:px-8" aria-labelledby="pm-faq">
        <h2 id="pm-faq" className="section-title mb-8 !text-3xl">
          {pm.faqTitle}
        </h2>
        <div className="divide-y divide-ink/10">
          {pm.faq.map((item, i) => (
            <details key={i} className="group py-5" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl text-ink transition hover:text-gold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="text-gold transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink/70">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <GoldenHour labels={t.goldenHour} photos={photos} />
    </>
  );
}
