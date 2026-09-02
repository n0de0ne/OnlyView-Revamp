import type { Locale } from "./i18n";

/**
 * The site's public address, used for every absolute link the server hands
 * out (emails, contract and portal links, redirects, canonicals, sitemap).
 *
 * `SITE_URL` is read at runtime, so the deployed container decides it;
 * `NEXT_PUBLIC_SITE_URL` is inlined into the bundle when the image is built,
 * so setting it on the container has no effect — the Docker entrypoint copies
 * it into SITE_URL for installs that already use that name.
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

export const ORG = {
  name: "Villa ONLY VIEW",
  legalName: "Villa ONLY VIEW — Saint-Barthélemy",
  url: SITE_URL,
  email: "contact@onlyviewstbarth.com",
  telephone: "+590 690 00 00 00",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Pointe Milou",
    addressLocality: "Saint-Barthélemy",
    postalCode: "97133",
    addressCountry: "FR",
    addressRegion: "Saint-Barthélemy",
  },
  geo: { "@type": "GeoCoordinates", latitude: 17.9124, longitude: -62.8272 },
};

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
}) {
  const fr = opts.locale === "fr";
  return {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    "@id": `${SITE_URL}/#villa`,
    name: "Villa ONLY VIEW",
    alternateName: "Only View St Barth",
    identifier: "villa-only-view-st-barth",
    description: fr
      ? "Villa de luxe de 4 chambres en suite à Pointe Milou, Saint-Barthélemy, avec piscine chauffée face à la mer, vue panoramique à 180°, ménage quotidien et conciergerie. Location en direct propriétaire, sans frais d'agence."
      : "Luxury 4-bedroom villa in Pointe Milou, Saint-Barthélemy, with heated ocean-facing pool, 180° panoramic sea views, daily housekeeping and concierge service. Rented directly by the owner with no agency fees.",
    url: SITE_URL + (fr ? "/fr" : ""),
    image: opts.images.map((u) => (u.startsWith("http") ? u : SITE_URL + u)),
    address: ORG.address,
    geo: ORG.geo,
    telephone: ORG.telephone,
    email: ORG.email,
    priceRange: opts.priceRange ?? "$10,000 – $50,000 per week",
    currenciesAccepted: "USD",
    petsAllowed: false,
    checkinTime: "15:00",
    checkoutTime: "11:00",
    numberOfRooms: 4,
    numberOfBathroomsTotal: 4,
    numberOfBedrooms: 4,
    occupancy: { "@type": "QuantitativeValue", maxValue: 8, unitText: "guests" },
    floorSize: { "@type": "QuantitativeValue", value: 200, unitCode: "MTK" },
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

export function lodgingBusinessJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${SITE_URL}/#business`,
    name: ORG.name,
    url: SITE_URL + (locale === "fr" ? "/fr" : ""),
    email: ORG.email,
    telephone: ORG.telephone,
    address: ORG.address,
    geo: ORG.geo,
    sameAs: [] as string[],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "reservations",
      email: ORG.email,
      telephone: ORG.telephone,
      availableLanguage: ["English", "French"],
    },
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

/** hreflang alternates for a path. */
export function altLanguages(path: string) {
  const clean = path === "/" ? "" : path;
  return {
    canonical: `${SITE_URL}${clean || "/"}`,
    languages: {
      en: `${SITE_URL}${clean || "/"}`,
      fr: `${SITE_URL}/fr${clean}`,
      "x-default": `${SITE_URL}${clean || "/"}`,
    },
  };
}
