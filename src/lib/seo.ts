import type { Metadata } from "next";
import type { Locale } from "./i18n";
import { CONTENT_UPDATED, OWNER_EMAIL, OWNER_PHONE, VILLA, VILLA_MAP_URL } from "./site-facts";

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

export const ORG = {
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
 * Primary entity: VacationRental (Google's dedicated type for villa rentals)
 * + LodgingBusiness fallback fields. This is the core of both SEO and GEO —
 * AI engines quote these structured facts directly.
 */
export function vacationRentalJsonLd(opts: {
  locale: Locale;
  images: string[];
  ratingValue?: number;
  reviewCount?: number;
  priceRange?: string;
  sameAs?: string[];
}) {
  const fr = opts.locale === "fr";
  return {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    "@id": `${SITE_URL}/#villa`,
    name: VILLA.name,
    alternateName: [...VILLA.alternateNames],
    identifier: "villa-only-view-st-barth",
    description: fr
      ? "Villa de luxe de 4 chambres en suite à Pointe Milou, Saint-Barthélemy, avec piscine chauffée face à la mer, vue panoramique à 180°, ménage quotidien et conciergerie. Location en direct propriétaire, sans frais d'agence."
      : "Luxury 4-bedroom villa in Pointe Milou, Saint-Barthélemy, with heated ocean-facing pool, 180° panoramic sea views, daily housekeeping and concierge service. Rented directly by the owner with no agency fees.",
    url: SITE_URL + (fr ? "/fr" : ""),
    image: absImages(opts.images),
    address: ORG.address,
    geo: ORG.geo,
    hasMap: ORG.hasMap,
    telephone: ORG.telephone,
    email: ORG.email,
    ...(opts.sameAs?.length ? { sameAs: opts.sameAs } : {}),
    priceRange: opts.priceRange ?? "$10,000 – $50,000 per week",
    currenciesAccepted: "USD",
    paymentAccepted: "Bank transfer",
    petsAllowed: false,
    smokingAllowed: false,
    checkinTime: VILLA.checkin,
    checkoutTime: VILLA.checkout,
    numberOfRooms: VILLA.bedrooms,
    numberOfBathroomsTotal: VILLA.bathrooms,
    numberOfBedrooms: VILLA.bedrooms,
    occupancy: { "@type": "QuantitativeValue", maxValue: VILLA.guests, unitText: "guests" },
    floorSize: { "@type": "QuantitativeValue", value: VILLA.sizeM2, unitCode: "MTK" },
    tourBookingPage: `${SITE_URL}${fr ? "/fr" : ""}/tour`,
    knowsLanguage: ["en", "fr"],
    containsPlace: [1, 2, 3, 4].map((n) => ({
      "@type": "Accommodation",
      name: `Bedroom ${n}`,
      bed: { "@type": "BedDetails", numberOfBeds: 1, typeOfBed: n <= 2 ? "King" : "Queen" },
      amenityFeature: [{ "@type": "LocationFeatureSpecification", name: "En-suite bathroom", value: true }],
    })),
    amenityFeature: [
      "Heated infinity pool",
      "180° ocean view",
      "Air conditioning",
      "5 Gbps fiber Wi-Fi",
      "Daily housekeeping",
      "Concierge service",
      "Fully equipped gourmet kitchen",
      "Sonos sound system",
      "BBQ grill",
      "Private parking",
      "Safe",
      "Ocean view terrace",
    ].map((name) => ({
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
  };
}

export function lodgingBusinessJsonLd(locale: Locale, sameAs: string[] = []) {
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${SITE_URL}/#business`,
    name: ORG.name,
    alternateName: [...VILLA.alternateNames],
    url: SITE_URL + (locale === "fr" ? "/fr" : ""),
    email: ORG.email,
    telephone: ORG.telephone,
    address: ORG.address,
    geo: ORG.geo,
    hasMap: ORG.hasMap,
    ...(sameAs.length ? { sameAs } : {}),
    founder: { "@id": `${SITE_URL}/#owner` },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "reservations",
      email: ORG.email,
      telephone: ORG.telephone,
      availableLanguage: ["English", "French"],
    },
  };
}

/** The organisation behind the site — rented by its owner, not an agency. */
export function organizationJsonLd(sameAs: string[] = []) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#org`,
    name: ORG.name,
    legalName: VILLA.legalOwner,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    email: ORG.email,
    telephone: ORG.telephone,
    address: ORG.address,
    founder: { "@id": `${SITE_URL}/#owner` },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** The owner, as an entity AI engines can attach the villa to. */
export function ownerJsonLd(locale: Locale) {
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
    about: { "@id": `${SITE_URL}/#villa` },
    dateModified: CONTENT_UPDATED,
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
