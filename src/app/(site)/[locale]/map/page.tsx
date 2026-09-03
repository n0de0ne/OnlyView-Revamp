import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { breadcrumbJsonLd, jsonLd, localeUrl, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { VILLA } from "@/lib/site-facts";
import { getMapPlaces, getVillaPoint } from "@/lib/map-places";
import { getPhotos, firstOf } from "@/lib/photos";
import { PageHero } from "@/components/site/PageHero";
import { IslandMap } from "@/components/site/map/IslandMap";
import type { MapPlaceDTO } from "@/components/site/map/map-meta";

export const revalidate = 3600;

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
    path: "/map",
    title: t.meta.titleMap,
    description: t.meta.descMap,
    image: "/media/photos/exterior/exterior-01.webp",
  });
}

/** schema.org type of a pin — what answer engines file it under */
function schemaType(p: MapPlaceDTO): string {
  switch (p.category) {
    case "beach":
      return "Beach";
    case "restaurant":
      return p.kind === "nightlife" ? "NightClub" : p.kind === "lounge" ? "BarOrPub" : "Restaurant";
    case "supermarket":
      return "GroceryStore";
    case "bakery":
      return "Bakery";
    case "pharmacy":
      return "Pharmacy";
    case "transport":
      return p.kind === "airport"
        ? "Airport"
        : p.kind === "ferry"
          ? "BoatTerminal"
          : p.kind === "info"
            ? "TouristInformationCenter"
            : "GasStation";
    case "sport":
      return p.kind === "gym" ? "ExerciseGym" : "SportsActivityLocation";
  }
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const fr = locale === "fr";
  const [places, villa, photos] = await Promise.all([getMapPlaces(locale), getVillaPoint(), getPhotos()]);

  const count = (c: MapPlaceDTO["category"]) => places.filter((p) => p.category === c).length;
  const maxDrive = Math.max(0, ...places.map((p) => p.driveMinutes ?? 0));
  const figures: Array<[string, string]> = [
    [String(count("beach")), t.map.figures.beaches],
    [String(count("restaurant")), t.map.figures.restaurants],
    [String(count("supermarket") + count("bakery") + count("pharmacy")), t.map.figures.shops],
    [`${maxDrive} ${t.map.min}`, t.map.figures.maxDrive],
  ];

  const touristDestination = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    "@id": `${localeUrl(locale, "/map")}#destination`,
    name: fr ? "Saint-Barthélemy — carte interactive" : "St Barth Interactive Map",
    description: t.meta.descMap,
    url: localeUrl(locale, "/map"),
    touristType: ["Beach", "Restaurant", "Shopping", "Luxury Travel"],
    geo: { "@type": "GeoCoordinates", latitude: villa[0], longitude: villa[1] },
    includesAttraction: places.map((p) => ({
      "@type": schemaType(p),
      name: p.name,
      url: `${localeUrl(locale, "/map")}#${p.slug}`,
      ...(p.description ? { description: p.description } : {}),
      geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng },
      address: {
        "@type": "PostalAddress",
        ...(p.zone ? { streetAddress: p.zone } : {}),
        addressLocality: VILLA.island,
        postalCode: VILLA.postalCode,
        addressCountry: VILLA.country,
      },
      ...(p.website ? { sameAs: p.website } : {}),
      ...(p.phone ? { telephone: p.phone } : {}),
    })),
  };

  const photo = firstOf(photos, "exterior");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            webPageJsonLd({ locale, path: "/map", name: t.map.title, description: t.meta.descMap }),
            touristDestination,
            breadcrumbJsonLd([
              { name: t.nav.home, url: fr ? "/fr" : "/" },
              { name: t.location.title, url: localePath(locale, "/location") },
              { name: t.map.label, url: localePath(locale, "/map") },
            ]),
          ]),
        }}
      />
      <PageHero eyebrow={t.map.label} title={t.map.title} intro={t.map.text} image={firstOf(photos, "night")} />

      {/* Key figures — the villa page's strip */}
      <section className="border-b border-ink/10 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-ink/10 px-5 text-center md:grid-cols-4 lg:px-8">
          {figures.map(([n, label]) => (
            <div key={label} className="px-4 py-8">
              <div className="font-display text-4xl text-gold">{n}</div>
              <div className="mt-1 text-[0.72rem] uppercase tracking-[0.2em] text-ink/50">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The explorer */}
      <section className="py-16 lg:py-24" aria-labelledby="map-explore">
        <div className="mx-auto mb-10 max-w-7xl px-5 lg:px-8">
          <p className="eyebrow mb-4">{t.map.exploreLabel}</p>
          <h2 id="map-explore" className="section-title">
            {t.map.exploreTitle}
          </h2>
          <p className="mt-6 max-w-3xl leading-relaxed text-ink/70">{t.map.intro}</p>
        </div>
        <IslandMap villa={villa} places={places} locale={locale} t={t.map} />
      </section>

      {/* The beaches, by what you want from them — a ledger */}
      <section className="border-y border-ink/10 bg-white" aria-labelledby="map-beach-uses">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="map-beach-uses" className="font-display text-3xl text-ink md:text-4xl">
              {t.map.beachesByUse}
            </h2>
            <p className="eyebrow !mb-0">{t.map.beachesTitle}</p>
          </div>
          <dl className="grid gap-x-10 border-t border-ink/10 sm:grid-cols-2 lg:grid-cols-3">
            {t.map.beachUses.map(([term, detail]) => (
              <div key={term} className="border-b border-ink/10 py-3.5 text-sm">
                <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-gold">{term}</dt>
                <dd className="mt-1 leading-snug text-ink/80">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Getting around — the location page's two columns */}
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="reveal">
            <p className="eyebrow mb-4">{t.map.label}</p>
            <h2 className="section-title mb-7 !text-4xl">{t.map.gettingAround}</h2>
            <p className="max-w-xl leading-relaxed text-ink/70">{t.map.gettingAroundText}</p>
            <ul className="mt-8 grid gap-y-3 text-sm text-ink/80">
              {t.map.gettingAroundTips.map((tip) => (
                <li key={tip} className="flex items-start gap-3">
                  <span className="mt-2 h-px w-6 shrink-0 bg-gold" aria-hidden />
                  {tip}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href={localePath(locale, "/guide/getting-here")} className="btn-outline">
                {t.location.mapCta}
              </Link>
              <Link href={localePath(locale, "/guide/best-beaches")} className="btn-outline">
                {fr ? "Les plus belles plages" : "The best beaches"}
              </Link>
            </div>
          </div>
          {photo && (
            <div className="reveal">
              <Image
                src={photo.url}
                alt={photo.alt}
                width={900}
                height={640}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="aspect-[4/3] w-full object-cover shadow-2xl shadow-ink/20"
              />
            </div>
          )}
        </div>
      </section>

      {/* Concierge — the home page's night CTA */}
      <section className="bg-night py-24 text-center text-white">
        <div className="mx-auto max-w-3xl px-5">
          <p className="eyebrow mb-4">{t.map.ctaLabel}</p>
          <h2 className="section-title mb-6 !text-white">{t.map.ctaTitle}</h2>
          <p className="mx-auto mb-10 max-w-xl leading-relaxed text-white/70">{t.map.ctaText}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={localePath(locale, "/contact")} className="btn-gold">
              {t.map.ctaButton}
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
