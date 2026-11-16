import type { Metadata } from "next";
import { ArrowUpRight, Map as MapIcon, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { getContent, villaFacts } from "@/lib/site-content";
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
import { getPhotos, firstOf } from "@/lib/photos";
import { getContact } from "@/lib/contact";
import { EditorialHero, SectionHead } from "@/components/site/ov/EditorialHero";
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
  const t = await getContent(locale);
  const VILLA = villaFacts();
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
  const t = await getContent(locale);
  const VILLA = villaFacts();
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
      <EditorialHero eyebrow={pm.label} title={pm.title} intro={pm.intro} image={firstOf(photos, "night")} />

      {/* Why here — the reasons, with the honest one last */}
      <section className="ov-shell py-24 md:py-32" aria-labelledby="pm-why">
        <SectionHead label={pm.label} title={pm.whyTitle} id="pm-why" aside={<p className="ov-body max-w-md">{pm.whyIntro}</p>} />
        <div className="ov-rule grid border-t sm:grid-cols-2 lg:grid-cols-3">
          {pm.why.map(([title, text], i) => (
            <div
              key={title}
              className={`ov-rule reveal flex flex-col gap-4 border-b py-8 sm:pr-8 lg:min-h-[17rem] `}
            >
              <span className="ov-label text-gold-dark">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-display text-[1.6rem] leading-tight text-ink md:text-[1.75rem]">{title}</h3>
              <p className="text-[0.92rem] leading-relaxed text-ink/65">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The whole package — shops, hotels, tables, beaches, all close by,
          numbered on from "Why stay". */}
      <section className="ov-shell pb-24 md:pb-32" aria-labelledby="pm-package">
        <SectionHead label={pm.packageLabel} title={pm.packageTitle} id="pm-package" aside={<p className="ov-body max-w-md">{pm.packageIntro}</p>} />
        <div className="ov-rule grid border-t sm:grid-cols-2 lg:grid-cols-3">
          {pm.package.map(([title, text], i) => (
            <div
              key={title}
              className={`ov-rule reveal flex flex-col gap-4 border-b py-8 sm:pr-8 lg:min-h-[17rem] `}
            >
              <span className="ov-label text-gold-dark">{String(pm.why.length + i + 1).padStart(2, "0")}</span>
              <h3 className="font-display text-[1.6rem] leading-tight text-ink md:text-[1.75rem]">{title}</h3>
              <p className="text-[0.92rem] leading-relaxed text-ink/65">{text}</p>
            </div>
          ))}
        </div>
        <p className="ov-intro mt-16 max-w-4xl text-ink">{pm.packageOutro}</p>
      </section>

      {/* What is there, and how far */}
      <section className="bg-ivory" aria-labelledby="pm-whats">
        <div className="ov-shell grid gap-16 py-24 md:py-32 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 id="pm-whats" className="ov-h3 mb-8 text-ink">
              {pm.whatsTitle}
            </h2>
            <dl className="ov-rule border-t">
              {pm.whats.map(([term, detail]) => (
                <div key={term} className="ov-rule border-b py-5">
                  <dt className="font-display text-xl text-ink">{term}</dt>
                  <dd className="mt-1.5 text-[0.92rem] leading-relaxed text-ink/65">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <h2 className="ov-h3 mb-8 text-ink">{pm.distancesTitle}</h2>
            <ul className="ov-rule border-t">
              {distances.map(([place, time]) => (
                <li key={place} className="ov-rule flex items-baseline justify-between gap-4 border-b py-4">
                  <span className="text-[0.95rem] text-ink/80">{place}</span>
                  <span className="font-mono text-sm text-gold-dark">{time}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={localePath(locale, "/guide/getting-here")} className="ov-btn ov-btn-ink">
                {t.location.mapCta}
              </Link>
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="ov-btn ov-btn-line">
                Google Maps
                <ArrowUpRight aria-hidden strokeWidth={1.4} />
              </a>
            </div>
            <Link href={localePath(locale, "/map")} className="ov-link group mt-8 text-ink">
              <MapIcon aria-hidden className="h-4 w-4 text-gold-dark" strokeWidth={1.5} />
              {t.location.islandMapCta}
              <ArrowUpRight className="ov-arrow h-4 w-4" strokeWidth={1.4} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* The neighbourhood, named — the places people search for near here */}
      <section className="ov-shell py-24 md:py-32" aria-labelledby="pm-nearby">
        <SectionHead title={t.nearby.title} id="pm-nearby" aside={<p className="ov-body max-w-md">{t.nearby.intro}</p>} />
        <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {t.nearby.items.map(([place, detail]) => (
            <li key={place} className="ov-rule border-t py-5">
              <span className="font-display text-xl text-ink">{place}</span>
              <span className="mt-1 block text-[0.9rem] leading-relaxed text-ink/60">{detail}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* The villa in it */}
      <section className="bg-sea py-24 text-white md:py-32" aria-labelledby="pm-villa">
        <div className="ov-shell grid items-center gap-12 lg:grid-cols-12">
          <div className="reveal lg:col-span-5">
            <p className="ov-label mb-5 text-white/55">
              <span className="mr-3 inline-block h-px w-8 translate-y-[-0.25em] bg-gold align-middle" aria-hidden />
              {VILLA.name}
            </p>
            <h2 id="pm-villa" className="ov-h2 mb-6">
              {pm.villaTitle}
            </h2>
            <p className="max-w-xl leading-relaxed text-white/70">{pm.villaText}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href={localePath(locale, "/booking")} className="ov-btn ov-btn-gold">
                {t.hero.cta}
              </Link>
              <Link href={localePath(locale, "/villa")} className="ov-btn ov-btn-glass">
                {pm.villaCta}
              </Link>
            </div>
          </div>
          {villaPhoto && (
            <Link href={localePath(locale, "/villa")} className="group reveal block lg:col-span-6 lg:col-start-7">
              <div className="ov-photo relative aspect-[4/3]">
                <Image
                  src={villaPhoto.url}
                  alt={villaPhoto.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* Questions people ask about the place */}
      <section className="ov-shell py-24 md:py-32" aria-labelledby="pm-faq">
        <div className="grid gap-10 lg:grid-cols-12">
          <h2 id="pm-faq" className="ov-h3 text-ink lg:col-span-4">
            {pm.faqTitle}
          </h2>
          <div className="ov-rule border-t lg:col-span-8">
            {pm.faq.map((item, i) => (
              <details key={i} className="ov-rule group border-b" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-6 font-display text-[1.4rem] leading-snug text-ink transition hover:text-gold-dark [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <Plus className="mt-1.5 h-5 w-5 shrink-0 text-gold-dark transition-transform duration-300 group-open:rotate-45" strokeWidth={1.25} aria-hidden />
                </summary>
                <p className="ov-body max-w-2xl pb-7">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <GoldenHour labels={t.goldenHour} photos={photos} />
    </>
  );
}
