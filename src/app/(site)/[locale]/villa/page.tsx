import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { breadcrumbJsonLd, jsonLd, pageMetadata, vacationRentalJsonLd } from "@/lib/seo";
import { getContact } from "@/lib/contact";
import { KeyFacts } from "@/components/site/KeyFacts";
import { getPhotos, firstOf } from "@/lib/photos";
import { PageHero } from "@/components/site/PageHero";

export const revalidate = 300;

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
    path: "/villa",
    title: t.meta.titleVilla,
    description: t.meta.descVilla,
    image: "/media/photos/exterior/exterior-01.webp",
  });
}

export default async function VillaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const [photos, { sameAs }] = await Promise.all([getPhotos(), getContact()]);

  const rooms: Array<{ cat: string; title: string; text: string }> = [
    { cat: "living", ...t.tour.stops.living },
    { cat: "kitchen", ...t.tour.stops.kitchen },
    { cat: "bedroom1", ...t.tour.stops.bedroom1 },
    { cat: "bedroom2", ...t.tour.stops.bedroom2 },
    { cat: "bedroom3", ...t.tour.stops.bedroom3 },
    { cat: "bedroom4", ...t.tour.stops.bedroom4 },
    { cat: "pool-terrace", ...t.tour.stops.pool },
  ];

  const amenities = [
    t.amenities.wifi,
    t.amenities.ac,
    t.amenities.pool,
    t.amenities.kitchen,
    t.amenities.sonos,
    t.amenities.tv,
    t.amenities.bbq,
    t.amenities.parking,
    t.amenities.safe,
    t.amenities.concierge,
    t.amenities.housekeeping,
    t.amenities.linens,
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            vacationRentalJsonLd({ locale, images: photos.slice(0, 8).map((p) => p.url), sameAs }),
            breadcrumbJsonLd([
              { name: t.nav.home, url: locale === "fr" ? "/fr" : "/" },
              { name: t.nav.villa, url: localePath(locale, "/villa") },
            ]),
          ]),
        }}
      />
      <PageHero
        eyebrow={t.intro.label}
        title={t.nav.villa}
        intro={t.meta.descVilla}
        image={firstOf(photos, "exterior")}
      />

      {/* Key figures */}
      <section className="border-b border-ink/10 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-ink/10 px-5 text-center md:grid-cols-5 lg:px-8">
          {[
            ["4", t.common.bedrooms],
            ["4", locale === "fr" ? "salles de bain" : "bathrooms"],
            ["8", t.common.guestsWord],
            ["200 m²", locale === "fr" ? "surface" : "living space"],
            ["180°", locale === "fr" ? "vue mer" : "ocean view"],
          ].map(([n, label]) => (
            <div key={label} className="px-4 py-8">
              <div className="font-display text-4xl text-gold">{n}</div>
              <div className="mt-1 text-[0.72rem] uppercase tracking-[0.2em] text-ink/50">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <KeyFacts title={t.seo.factsTitle}
        label={t.seo.factsLabel}
        summary={t.seo.factsSummary}
        toggle={t.seo.factsToggle}
        facts={t.seo.facts} className="border-b border-ink/10" />

      {/* Rooms — alternating layout */}
      <section className="mx-auto max-w-7xl space-y-24 px-5 py-24 lg:px-8">
        {rooms.map((room, i) => {
          const photo = firstOf(photos, room.cat);
          if (!photo) return null;
          return (
            <div
              key={room.cat}
              className={`grid items-center gap-10 lg:grid-cols-2 ${
                i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <Link
                href={localePath(locale, `/gallery?c=${room.cat}`)}
                className="group block overflow-hidden reveal"
              >
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  width={900}
                  height={640}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </Link>
              <div className="reveal">
                <p className="eyebrow mb-3">{String(i + 1).padStart(2, "0")}</p>
                <h2 className="font-display text-3xl text-ink md:text-4xl">{room.title}</h2>
                <p className="mt-4 max-w-lg leading-relaxed text-ink/70">{room.text}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Amenity list */}
      <section className="bg-night py-20 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="section-title mb-10 !text-white">{t.amenities.title}</h2>
          <ul className="grid grid-cols-1 gap-x-10 gap-y-4 text-sm text-white/80 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((a) => (
              <li key={a} className="flex items-center gap-3 border-b border-white/10 pb-3">
                <span className="h-1.5 w-1.5 rotate-45 bg-gold" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
          <div className="mt-12 flex flex-wrap gap-4">
            <Link href={localePath(locale, "/tour")} className="btn-gold">
              {t.spaces.tourCta}
            </Link>
            <Link href={localePath(locale, "/booking")} className="btn-outline-light">
              {t.hero.cta}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
