import type { Metadata } from "next";
import Link from "next/link";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { breadcrumbJsonLd, jsonLd, localeUrl, pageMetadata, SITE_URL, webPageJsonLd } from "@/lib/seo";
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
      ...(p.description ? { description: p.description } : {}),
      geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng },
      address: {
        "@type": "PostalAddress",
        ...(p.zone ? { streetAddress: p.zone } : {}),
        addressLocality: VILLA.island,
        postalCode: VILLA.postalCode,
        addressCountry: VILLA.country,
      },
      ...(p.website ? { url: p.website } : {}),
      ...(p.phone ? { telephone: p.phone } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            webPageJsonLd({
              locale,
              path: "/map",
              name: t.map.title,
              description: t.meta.descMap,
            }),
            touristDestination,
            breadcrumbJsonLd([
              { name: t.nav.home, url: fr ? "/fr" : "/" },
              { name: t.location.title, url: localePath(locale, "/location") },
              { name: t.map.label, url: localePath(locale, "/map") },
            ]),
          ]),
        }}
      />
      <PageHero eyebrow={t.map.label} title={t.map.title} intro={t.map.text} image={firstOf(photos, "exterior")} />

      <section className="mx-auto max-w-3xl px-5 py-12 text-center lg:px-8">
        <p className="leading-relaxed text-ink/70">{t.map.intro}</p>
      </section>

      <IslandMap villa={villa} places={places} locale={locale} t={t.map} />

      {/* the beaches, by what you want from them — the legacy page's cards */}
      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        <h2 className="section-title mb-8 text-center !text-3xl">{t.map.beachesByUse}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.map.beachUses.map(([title, text]) => (
            <li key={title} className="rounded-2xl bg-sand p-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-navy">{title}</h3>
              <p className="text-sm leading-relaxed text-ink/70">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-ink/10 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
          <h2 className="section-title mb-4 !text-3xl">{t.map.gettingAround}</h2>
          <p className="leading-relaxed text-ink/70">{t.map.gettingAroundText}</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href={localePath(locale, "/guide/getting-here")} className="btn-outline">
              {t.location.mapCta}
            </Link>
            <Link href={localePath(locale, "/guide/best-beaches")} className="btn-outline">
              {fr ? "Les plus belles plages" : "The best beaches"}
            </Link>
            <Link href={localePath(locale, "/guide/best-restaurants")} className="btn-outline">
              {fr ? "Où dîner" : "Where to eat"}
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-sand to-white px-5 py-16 text-center">
        <h2 className="section-title mb-4 !text-3xl">{t.map.ctaTitle}</h2>
        <p className="mx-auto mb-8 max-w-xl leading-relaxed text-ink/70">{t.map.ctaText}</p>
        <Link href={localePath(locale, "/contact")} className="btn-gold">
          {t.map.ctaButton}
        </Link>
        <p className="mt-6 text-xs text-ink/40">
          <a href={`${SITE_URL}${fr ? "/fr" : ""}/location`} className="hover:text-gold">
            {t.location.label} — {t.location.title}
          </a>
        </p>
      </section>
    </>
  );
}
