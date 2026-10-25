import type { Metadata } from "next";
import type { Locale } from "./i18n";
import { villaFacts } from "./site-content";
import { CONTENT_UPDATED, ISLAND, OWNER_EMAIL, OWNER_PHONE, POINTE_MILOU, VILLA_MAP_URL } from "./site-facts";

/**
 * The site's public address, used for every absolute link the server hands
 * out (emails, contract and portal links, redirects, canonicals, sitemap).
 *
 * `SITE_URL` is read at runtime, so the deployed container decides it;
 * `NEXT_PUBLIC_SITE_URL` is inlined into the bundle when the image is built,
 * so setting it on the container has no effect — the Docker entrypoint copies
 * it into SITE_URL for installs that already use that name. Statically
 * prerendered pages bake the build-time value (the Dockerfile's default is
 * the production domain).
 */
function resolveSiteUrl(): string {
  const raw = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (!raw) return "https://onlyviewstbarth.com";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    // a host the container only listens on is not an address anyone can open
    if (["0.0.0.0", "::", "[::]"].includes(url.hostname)) return "https://onlyviewstbarth.com";
    return withScheme.replace(/\/+$/, "");
  } catch {
    return "https://onlyviewstbarth.com";
  }
}

export const SITE_URL = resolveSiteUrl();

/** Absolute URL on the public site — never derived from the incoming request,
    whose Host a reverse proxy can rewrite (nginx sends its upstream address
    unless it sets `proxy_set_header Host $host`). */
export const siteUrl = (path: string) =>
  new URL(path.startsWith("/") ? path : `/${path}`, `${SITE_URL}/`).toString();

/** `/x` for English, `/fr/x` for French — the public URL of a page. */
export const localeUrl = (locale: Locale, path: string) => {
  const clean = path === "/" ? "" : path;
  return `${SITE_URL}${locale === "fr" ? "/fr" : ""}${clean || (locale === "fr" ? "" : "/")}`;
};

/** The image every share card falls back to (1200×900 heated pool at sunset). */
export const DEFAULT_OG_IMAGE = "/media/photos/pool-terrace/pool-terrace-01.webp";

/** The villa as an organisation, from its facts in the database (see villaFacts). */
function org() {
  const VILLA = villaFacts();
  return {
  name: VILLA.name,
  legalName: `${VILLA.name} — ${VILLA.island}`,
  url: SITE_URL,
  email: OWNER_EMAIL,
  telephone: OWNER_PHONE,
  address: {
    "@type": "PostalAddress",
    streetAddress: VILLA.neighbourhood,
    addressLocality: VILLA.island,
    postalCode: VILLA.postalCode,
    addressCountry: VILLA.country,
    addressRegion: VILLA.island,
  },
  geo: { "@type": "GeoCoordinates", latitude: VILLA.lat, longitude: VILLA.lng },
  hasMap: VILLA_MAP_URL,
  };
}

/* ─────────────────────────── page metadata ─────────────────────────── */

/**
 * hreflang alternates + the canonical of *this* language's page. The
 * canonical used to point at the English URL for both languages, which tells
 * Google the French pages are duplicates to drop.
 */
export function altLanguages(path: string, locale: Locale = "en") {
  const clean = path === "/" ? "" : path;
  return {
    canonical: locale === "fr" ? `${SITE_URL}/fr${clean}` : `${SITE_URL}${clean || "/"}`,
    languages: {
      en: `${SITE_URL}${clean || "/"}`,
      fr: `${SITE_URL}/fr${clean}`,
      "x-default": `${SITE_URL}${clean || "/"}`,
    },
  };
}

/**
 * Everything a page needs in <head>, in one call: title, description,
 * canonical + hreflang, Open Graph (with an absolute og:url and image) and
 * a large Twitter card. `absoluteTitle` skips the "| Villa ONLY VIEW St Barth"
 * template (the home page carries the brand itself).
 */
export function pageMetadata(opts: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  absoluteTitle?: boolean;
  noindex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const VILLA = villaFacts();
  const image = opts.image ?? DEFAULT_OG_IMAGE;
  const absImage = image.startsWith("http") ? image : `${SITE_URL}${image}`;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: altLanguages(opts.path, opts.locale),
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: opts.type ?? "website",
      siteName: VILLA.name,
      locale: opts.locale === "fr" ? "fr_FR" : "en_US",
      alternateLocale: opts.locale === "fr" ? "en_US" : "fr_FR",
      url: localeUrl(opts.locale, opts.path),
      title: opts.title,
      description: opts.description,
      images: [{ url: absImage, width: 1200, height: 900, alt: opts.imageAlt ?? VILLA.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [absImage],
    },
  };
}

/* ─────────────────────────── structured data ─────────────────────────── */

const absImages = (images: string[]) =>
  images.map((u) => (u.startsWith("http") ? u : SITE_URL + u));

/**
 * The photos the villa's structured data carries: one of each space first
 * (pool and view lead, then living, kitchen, every bedroom, night, outside),
 * then the rest, up to `max`. Photos come back sorted by category name, so a
 * plain slice used to hand engines eight bedrooms and no pool. Google's
 * vacation-rental spec wants at least 8, with a bedroom and a common area.
 */
export function schemaImages(photos: Array<{ category: string; url: string }>, max = 12): string[] {
  const order = ["pool-terrace", "living", "exterior", "kitchen", "bedroom1", "bedroom2", "bedroom3", "bedroom4", "night"];
  const picked: string[] = [];
  for (const cat of order) {
    const p = photos.find((x) => x.category === cat);
    if (p) picked.push(p.url);
  }
  for (const p of photos) {
    if (picked.length >= max) break;
    if (!picked.includes(p.url)) picked.push(p.url);
  }
  return picked.slice(0, max);
}

/** Amenities in the names Google's vacation-rental spec reads (English
    only, even on the French pages), then the villa's own in plain words. */
const SPEC_AMENITIES = ["ac", "wifi", "pool", "kitchen", "tv", "outdoorGrill", "patio", "childFriendly"];
const PLAIN_AMENITIES = [
  "Heated infinity pool",
  "180° ocean view",
  "5 Gbps fiber Wi-Fi",
  "Daily housekeeping",
  "Concierge service",
  "Fully equipped gourmet kitchen",
  "Sonos sound system",
  "Private parking",
  "Safe",
  "Ocean view terrace",
];

/**
 * Primary entity: VacationRental, laid out the way Google's vacation-rental
 * structured data asks — the house itself as one `EntirePlace` Accommodation
 * in `containsPlace`, latitude/longitude at the top. VacationRental is a
 * LodgingBusiness, so it also carries the contact point: one entity for the
 * villa, not a separate "business" node competing with it. This is the core
 * of both SEO and GEO — AI engines quote these structured facts directly.
 */
export function vacationRentalJsonLd(opts: {
  locale: Locale;
  images: string[];
  ratingValue?: number;
  reviewCount?: number;
  priceRange?: string;
  sameAs?: string[];
  /** a few approved guest reviews, inlined as `review` (review snippets) */
  reviews?: Array<{ name: string; rating: number; message: string; date?: string }>;
}) {
  const VILLA = villaFacts();
  const ORG = org();
  const fr = opts.locale === "fr";
  return {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    "@id": `${SITE_URL}/#villa`,
    additionalType: "Villa",
    name: VILLA.name,
    alternateName: [...VILLA.alternateNames],
    identifier: "villa-only-view-st-barth",
    description: fr
      ? "Villa ONLY VIEW (Only View St Barth / St Barts) : villa de luxe de 4 chambres en suite à Pointe Milou, Saint-Barthélemy, avec piscine chauffée face à la mer, vue panoramique à 180°, ménage quotidien et conciergerie. Site officiel, location en direct propriétaire, sans frais d'agence."
      : "Villa ONLY VIEW (Only View St Barts / St Barth): luxury 4-bedroom villa in Pointe Milou, Saint-Barthélemy, with heated ocean-facing pool, 180° panoramic sea views, daily housekeeping and concierge service. Official website, rented directly by the owner with no agency fees.",
    url: SITE_URL + (fr ? "/fr" : ""),
    mainEntityOfPage: SITE_URL + (fr ? "/fr" : ""),
    image: absImages(opts.images),
    address: ORG.address,
    latitude: VILLA.lat,
    longitude: VILLA.lng,
    geo: ORG.geo,
    hasMap: ORG.hasMap,
    // the neighbourhood as an entity of its own (see pointeMilouJsonLd), so
    // "villa in Pointe Milou" resolves to this house
    containedInPlace: { "@id": `${SITE_URL}/#pointe-milou` },
    telephone: ORG.telephone,
    email: ORG.email,
    brand: { "@type": "Brand", "@id": `${SITE_URL}/#org`, name: VILLA.name },
    founder: { "@id": `${SITE_URL}/#owner` },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "reservations",
      email: ORG.email,
      telephone: ORG.telephone,
      availableLanguage: ["English", "French"],
    },
    ...(opts.sameAs?.length ? { sameAs: opts.sameAs } : {}),
    priceRange: opts.priceRange ?? "$10,000 – $50,000 per week",
    currenciesAccepted: "USD",
    paymentAccepted: "Bank transfer",
    petsAllowed: false,
    smokingAllowed: false,
    checkinTime: VILLA.checkin,
    checkoutTime: VILLA.checkout,
    tourBookingPage: `${SITE_URL}${fr ? "/fr" : ""}/tour`,
    knowsLanguage: ["en", "fr"],
    containsPlace: {
      "@type": "Accommodation",
      additionalType: "EntirePlace",
      name: VILLA.name,
      numberOfBedrooms: VILLA.bedrooms,
      numberOfBathroomsTotal: VILLA.bathrooms,
      occupancy: { "@type": "QuantitativeValue", value: VILLA.guests },
      floorSize: { "@type": "QuantitativeValue", value: VILLA.sizeM2, unitCode: "MTK" },
      bed: [
        { "@type": "BedDetails", numberOfBeds: 2, typeOfBed: "King" },
        { "@type": "BedDetails", numberOfBeds: 2, typeOfBed: "Queen" },
      ],
      amenityFeature: [
        ...SPEC_AMENITIES.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
        { "@type": "LocationFeatureSpecification", name: "poolType", value: "Private" },
        { "@type": "LocationFeatureSpecification", name: "parkingType", value: "Free" },
        { "@type": "LocationFeatureSpecification", name: "internetType", value: "Free" },
      ],
    },
    amenityFeature: PLAIN_AMENITIES.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
    ...(opts.ratingValue && opts.reviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: opts.ratingValue,
            reviewCount: opts.reviewCount,
            bestRating: 5,
          },
        }
      : {}),
    ...(opts.reviews?.length
      ? {
          review: opts.reviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.name },
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            reviewBody: r.message,
            ...(r.date ? { datePublished: r.date } : {}),
          })),
        }
      : {}),
  };
}

/**
 * Pointe Milou as a Place: the neighbourhood people search for, with its
 * coordinates, the island it belongs to (anchored to Wikidata/Wikipedia so
 * engines resolve the right Saint-Barthélemy) and the villa inside it.
 */
export function pointeMilouJsonLd(locale: Locale, description: string) {
  const VILLA = villaFacts();
  const fr = locale === "fr";
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": `${SITE_URL}/#pointe-milou`,
    name: POINTE_MILOU.name,
    alternateName: [`${POINTE_MILOU.name}, ${ISLAND.name}`, `${POINTE_MILOU.name}, St Barth`, `${POINTE_MILOU.name}, St Barts`],
    description,
    url: localeUrl(locale, "/pointe-milou"),
    geo: { "@type": "GeoCoordinates", latitude: POINTE_MILOU.lat, longitude: POINTE_MILOU.lng },
    address: {
      "@type": "PostalAddress",
      addressLocality: ISLAND.name,
      postalCode: VILLA.postalCode,
      addressCountry: ISLAND.country,
    },
    containedInPlace: {
      "@type": "AdministrativeArea",
      name: ISLAND.name,
      alternateName: [...ISLAND.aliases],
      sameAs: [ISLAND.wikidata, ISLAND.wikipedia],
    },
    containsPlace: { "@id": `${SITE_URL}/#villa` },
    hasMap: localeUrl(locale, "/map"),
    touristType: fr ? ["Villas de luxe", "Couchers de soleil", "Séjour au calme"] : ["Luxury villas", "Sunsets", "Quiet stays"],
  };
}

/** The organisation behind the site — rented by its owner, not an agency. */
export function organizationJsonLd(sameAs: string[] = []) {
  const VILLA = villaFacts();
  const ORG = org();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#org`,
    name: ORG.name,
    alternateName: [...VILLA.alternateNames],
    legalName: VILLA.legalOwner,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 512, height: 512 },
    image: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
    email: ORG.email,
    telephone: ORG.telephone,
    address: ORG.address,
    founder: { "@id": `${SITE_URL}/#owner` },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** The owner, as an entity AI engines can attach the villa to. */
export function ownerJsonLd(locale: Locale) {
  const VILLA = villaFacts();
  const ORG = org();
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/#owner`,
    name: VILLA.ownerName,
    givenName: VILLA.ownerFirstName,
    jobTitle: locale === "fr" ? "Propriétaire, Villa ONLY VIEW" : "Owner, Villa ONLY VIEW",
    worksFor: { "@id": `${SITE_URL}/#org` },
    email: ORG.email,
    telephone: ORG.telephone,
    knowsLanguage: ["fr", "en"],
    homeLocation: { "@type": "Place", name: `${VILLA.neighbourhood}, ${VILLA.island}` },
  };
}

export function websiteJsonLd(locale: Locale) {
  const VILLA = villaFacts();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL + (locale === "fr" ? "/fr" : ""),
    name: VILLA.name,
    alternateName: [...VILLA.alternateNames],
    inLanguage: locale === "fr" ? "fr-FR" : "en-US",
    publisher: { "@id": `${SITE_URL}/#org` },
    about: { "@id": `${SITE_URL}/#villa` },
  };
}

/** A plain WebPage node — gives the contact / why-direct / guide-index pages
    an entity of their own, with the villa as subject. */
export function webPageJsonLd(opts: {
  locale: Locale;
  path: string;
  name: string;
  description: string;
  type?: "WebPage" | "ContactPage" | "CollectionPage" | "AboutPage" | "ImageGallery";
  /** the page's subject when it is not the villa itself (a Place, a guide) */
  about?: { "@id": string };
  datePublished?: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": opts.type ?? "WebPage",
    "@id": `${localeUrl(opts.locale, opts.path)}#webpage`,
    url: localeUrl(opts.locale, opts.path),
    name: opts.name,
    description: opts.description,
    inLanguage: opts.locale === "fr" ? "fr-FR" : "en-US",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: opts.about ?? { "@id": `${SITE_URL}/#villa` },
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    dateModified: opts.dateModified ?? CONTENT_UPDATED,
  };
}

export function imageGalleryJsonLd(
  locale: Locale,
  photos: Array<{ url: string; alt: string; width: number; height: number }>
) {
  return {
    ...webPageJsonLd({
      locale,
      path: "/gallery",
      name: locale === "fr" ? "Galerie photos — Villa ONLY VIEW" : "Photo gallery — Villa ONLY VIEW",
      description:
        locale === "fr"
          ? "Photos de la Villa ONLY VIEW, Pointe Milou, St Barth."
          : "Photos of Villa ONLY VIEW, Pointe Milou, St Barth.",
      type: "ImageGallery",
    }),
    image: photos.map((p) => ({
      "@type": "ImageObject",
      contentUrl: SITE_URL + p.url,
      url: SITE_URL + p.url,
      name: p.alt,
      caption: p.alt,
      width: p.width,
      height: p.height,
      representativeOfPage: false,
    })),
  };
}

export function itemListJsonLd(items: Array<{ name: string; url: string; description?: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url.startsWith("http") ? it.url : SITE_URL + it.url,
      ...(it.description ? { description: it.description } : {}),
    })),
  };
}

export function faqJsonLd(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : SITE_URL + item.url,
    })),
  };
}

export function reviewsJsonLd(
  reviews: Array<{ name: string; rating: number; message: string; date?: string }>
) {
  return reviews.map((r) => ({
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: { "@id": `${SITE_URL}/#villa` },
    author: { "@type": "Person", name: r.name },
    reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
    reviewBody: r.message,
    ...(r.date ? { datePublished: r.date } : {}),
  }));
}

/** Serialize JSON-LD for a <script> tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
