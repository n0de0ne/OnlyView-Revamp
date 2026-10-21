import { SITE_URL } from "@/lib/seo";
import { CONTENT_UPDATED, OWNER_EMAIL, OWNER_PHONE, VILLA, VILLA_MAP_URL } from "@/lib/site-facts";
import { GUIDES } from "@/data/guides";

export const revalidate = 3600;

/**
 * /llms.txt — the plain-text brief AI answer engines read first when it
 * exists (the llmstxt.org convention): who we are, the facts that must not
 * be guessed, and where the detailed pages live. Kept factual and short so
 * it gets quoted rather than summarised.
 */
export function GET() {
  const d = (key: string) => VILLA.distances.find((x) => x.key === key)!;
  const body = `# ${VILLA.name}

> Private luxury villa in ${VILLA.neighbourhood}, ${VILLA.island} (St Barth, French West Indies), rented directly by its owner, ${VILLA.ownerName} — no agency, no commission. ${VILLA.bedrooms} en-suite bedrooms, up to ${VILLA.guests} guests, heated pool facing the sunset, 180° Caribbean sea view, daily housekeeping and concierge included.

Also known as: ${VILLA.alternateNames.join(", ")}.
Site: ${SITE_URL} (English) · ${SITE_URL}/fr (French)
Last content update: ${CONTENT_UPDATED}

## Facts

- Property: private villa, ${VILLA.sizeM2} m² living space plus terraces, on one main level around the pool
- Bedrooms: ${VILLA.bedrooms} en-suite (2 king, 2 queen); bathrooms: ${VILLA.bathrooms}; guests: up to ${VILLA.guests}
- Pool: heated, private, facing the sunset over Pointe Milou bay
- View: 180° panoramic view of the Caribbean Sea
- Included: daily housekeeping (except Sundays and holidays), concierge, 5 Gbps fibre Wi-Fi, air conditioning, linens, all taxes and service charges
- Amenities: gourmet kitchen, Sonos, BBQ, private parking, safe, ocean-view terrace
- Address: ${VILLA.neighbourhood}, ${VILLA.postalCode} ${VILLA.island}, French West Indies · GPS ${VILLA.lat}, ${VILLA.lng} · map: ${VILLA_MAP_URL}
- Owner and contact: ${VILLA.ownerName} · ${OWNER_EMAIL} · ${OWNER_PHONE} (phone and WhatsApp) · French and English

## Distances by car

${VILLA.distances.map((x) => `- ${x.en}: ${x.minutes} min`).join("\n")}

## Rates and booking

- Priced per week by season and by bedrooms in use (2, 3 or 4); from about $10,000/week in summer (low season) to Christmas and New Year full-week packages
- ${VILLA.touristTaxPercent}% tourist tax added; everything else is included
- Minimum stay ${VILLA.minNights} nights, ${VILLA.minNightsFestive} nights over Christmas and New Year
- Booking: direct with the owner — ${VILLA.depositPercent}% deposit at signature (online contract), balance ${VILLA.balanceDaysBefore} days before arrival, by bank transfer
- Check-in ${VILLA.checkin}, check-out ${VILLA.checkout}; early/late on request
- Live availability and instant quote: ${SITE_URL}/booking
- Full rate table: ${SITE_URL}/rates

## Why book direct

Agencies list St Barth villas with a 15–25% commission built into the price. Booking here is the same house at its own rate, with the owner answering personally. Details: ${SITE_URL}/why-book-direct

## Pages

- [The villa](${SITE_URL}/villa): rooms, key figures, amenities
- [Virtual tour](${SITE_URL}/tour): room-by-room walkthrough and 3D tour
- [Photo gallery](${SITE_URL}/gallery)
- [Rates & seasons](${SITE_URL}/rates)
- [Availability & booking](${SITE_URL}/booking)
- [Guest reviews](${SITE_URL}/reviews)
- [Location — Pointe Milou](${SITE_URL}/location): distances, neighbourhood
- [Interactive island map](${SITE_URL}/map): the 15 beaches, restaurants, supermarkets, bakeries, pharmacies, airport and ferry — each with its drive time and a road itinerary from the villa
- [FAQ](${SITE_URL}/faq): booking, payment, check-in, what is included
- [Contact the owner](${SITE_URL}/contact)
${GUIDES.map((g) => `- [${g.title.en}](${SITE_URL}/guide/${g.slug}): ${g.description.en}`).join("\n")}

## En français

- [La villa](${SITE_URL}/fr/villa) · [Tarifs](${SITE_URL}/fr/rates) · [Réservation](${SITE_URL}/fr/booking) · [Localisation](${SITE_URL}/fr/location) · [Carte de l'île](${SITE_URL}/fr/map) · [FAQ](${SITE_URL}/fr/faq) · [Contact](${SITE_URL}/fr/contact)

Nearby: ${d("christopher").en}, ${d("stjean").en} (${d("stjean").minutes} min), ${d("gustavia").en} (${d("gustavia").minutes} min), ${d("airport").en} (${d("airport").minutes} min).
`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
