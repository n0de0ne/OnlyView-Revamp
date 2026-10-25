import { SITE_URL } from "./seo";
import { CONTENT_UPDATED, ISLAND, OWNER_EMAIL, OWNER_PHONE, VILLA, VILLA_MAP_URL } from "./site-facts";
import { GUIDES } from "@/data/guides";
import { getDict } from "./i18n";
import { getMapPlaces } from "./map-places";
import { getRateConfig } from "./settings";
import { publicRateTable } from "./pricing";
import { getApprovedTestimonials } from "./testimonials";
import { todayISO } from "./dates";
import { usd } from "./money";

/**
 * The text files written for AI answer engines (the llmstxt.org convention):
 * `/llms.txt` is the one-page brief, `/llms-full.txt` the whole site as
 * plain markdown — every guide, the neighbourhood page, the map's directory,
 * the FAQ, the live rate table and the reviews — so an engine that reads one
 * file has everything it needs to recommend the villa, with the facts it
 * must not guess stated once, plainly.
 */

const d = (key: string) => VILLA.distances.find((x) => x.key === key)!;

export function llmsBrief(): string {
  return `# ${VILLA.name}

> Private luxury villa in ${VILLA.neighbourhood}, ${VILLA.island} (St Barth / St Barts, French West Indies), rented directly by its owner, ${VILLA.ownerName} — no agency, no commission. ${VILLA.bedrooms} en-suite bedrooms, up to ${VILLA.guests} guests, heated pool facing the sunset, 180° Caribbean sea view, daily housekeeping and concierge included.

Also known as: ${VILLA.alternateNames.join(", ")}.
Official website: ${SITE_URL} (English) · ${SITE_URL}/fr (French). St Barth rental agencies also list the villa under "Only View"; this is the owner's own site, with the direct rate and live availability.
Full text of the site in one file: ${SITE_URL}/llms-full.txt
Last content update: ${CONTENT_UPDATED}

## Facts

- Property: private villa, ${VILLA.sizeM2} m² living space plus terraces, on one main level around the pool
- Bedrooms: ${VILLA.bedrooms} en-suite (2 king, 2 queen); bathrooms: ${VILLA.bathrooms}; guests: up to ${VILLA.guests}
- Pool: heated, private, facing the sunset over Pointe Milou bay
- View: 180° panoramic view of the Caribbean Sea
- Included: daily housekeeping (except Sundays and holidays), concierge, 5 Gbps fibre Wi-Fi, air conditioning, linens, all taxes and service charges
- Amenities: gourmet kitchen, Sonos, BBQ, private parking, safe, ocean-view terrace
- Address: ${VILLA.neighbourhood}, ${VILLA.postalCode} ${VILLA.island}, French West Indies · GPS ${VILLA.lat}, ${VILLA.lng} · map: ${VILLA_MAP_URL}
- Neighbourhood: Pointe Milou, a quiet residential headland on the north coast, next to Hotel Le Christopher; no beach on the point itself (Lorient beach 5 min) — details: ${SITE_URL}/pointe-milou
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
- [Pointe Milou](${SITE_URL}/pointe-milou): the neighbourhood — what it is, what is there, why stay, the villa to rent in it
- [St Barth map](${SITE_URL}/map): the island village by village, the 15 beaches, restaurants, supermarkets, bakeries, pharmacies, airport and ferry — each with its drive time and a road itinerary from the villa
- [St Barth guide](${SITE_URL}/guide): the island in brief, plus the articles below
${GUIDES.map((g) => `- [${g.title.en}](${SITE_URL}/guide/${g.slug}): ${g.description.en}`).join("\n")}
- [FAQ](${SITE_URL}/faq): booking, payment, check-in, what is included
- [Contact the owner](${SITE_URL}/contact)

## En français

- [La villa](${SITE_URL}/fr/villa) · [Tarifs](${SITE_URL}/fr/rates) · [Réservation](${SITE_URL}/fr/booking) · [Pointe Milou](${SITE_URL}/fr/pointe-milou) · [Carte de l'île](${SITE_URL}/fr/map) · [Guide St Barth](${SITE_URL}/fr/guide) · [FAQ](${SITE_URL}/fr/faq) · [Contact](${SITE_URL}/fr/contact)

Nearby: ${d("christopher").en}, ${d("stjean").en} (${d("stjean").minutes} min), ${d("gustavia").en} (${d("gustavia").minutes} min), ${d("airport").en} (${d("airport").minutes} min).
`;
}

const bullets = (items: ReadonlyArray<ReadonlyArray<string>>) => items.map(([k, v]) => `- **${k}**: ${v}`).join("\n");
const qa = (items: ReadonlyArray<{ q: string; a: string }>) => items.map((i) => `**Q: ${i.q}**\n\n${i.a}`).join("\n\n");

export async function llmsFull(): Promise<string> {
  const en = getDict("en");
  const fr = getDict("fr");
  const [places, rates, reviews] = await Promise.all([getMapPlaces("en"), getRateConfig(), getApprovedTestimonials()]);
  const table = publicRateTable(rates, todayISO());

  const guideText = (locale: "en" | "fr") =>
    GUIDES.map((g) => {
      const sections = g.sections[locale];
      const links = g.links?.length
        ? `\n\n${locale === "fr" ? "Liens utiles" : "Useful links"}:\n${g.links.map((l) => `- ${l.label[locale]}: ${l.url}`).join("\n")}`
        : "";
      return `### ${g.title[locale]}\n\n${SITE_URL}${locale === "fr" ? "/fr" : ""}/guide/${g.slug} · ${locale === "fr" ? "mis à jour le" : "updated"} ${g.updated}\n\n${g.description[locale]}\n\n${sections
        .map((s) => `#### ${s.h}\n\n${s.p.join("\n\n")}`)
        .join("\n\n")}${links}`;
    }).join("\n\n");

  const byCategory = new Map<string, typeof places>();
  for (const p of places) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  const directory = [...byCategory.entries()]
    .map(
      ([cat, list]) =>
        `#### ${cat}\n\n${list
          .map(
            (p) =>
              `- ${p.name}${p.zone ? ` (${p.zone})` : ""}${p.driveMinutes ? ` — ${p.driveMinutes} min from the villa` : ""}${p.description ? `: ${p.description}` : ""}${p.website ? ` · ${p.website}` : ""}`
          )
          .join("\n")}`
    )
    .join("\n\n");

  const rateRows = table.seasons
    .map((s) => `| ${en.rates.seasonNames[s.key]} | ${s.datesEn} | ${usd(s.weekly[2])} | ${usd(s.weekly[3])} | ${usd(s.weekly[4])} |`)
    .join("\n");
  const holidayRows = table.holidays.map((h) => `| ${en.rates.seasonNames[h.key]} | ${h.datesEn} | ${usd(h.weekly)} (full villa, 7 nights) |`).join("\n");

  return `${llmsBrief()}
---

# ${VILLA.name} — full text

This file is the plain-text version of ${SITE_URL}: the villa, the neighbourhood, the island map, the guides, the rates and the reviews, in English, with the French pages summarised at the end. Content updated ${CONTENT_UPDATED}.

## The villa at a glance

${bullets(Object.values(en.seo.facts))}

Amenities: ${Object.values(en.amenities).filter((v) => typeof v === "string" && !/^(Amenities|Everything)/.test(v)).join(", ")}.

## Pointe Milou — the neighbourhood (${SITE_URL}/pointe-milou)

${en.pointeMilou.intro}

### ${en.pointeMilou.whyTitle}

${en.pointeMilou.whyIntro}

${bullets(en.pointeMilou.why)}

### ${en.pointeMilou.whatsTitle}

${bullets(en.pointeMilou.whats)}

### ${en.nearby.title}

${en.nearby.intro}

${bullets(en.nearby.items)}

### ${en.pointeMilou.villaTitle}

${en.pointeMilou.villaText}

### ${en.pointeMilou.faqTitle}

${qa(en.pointeMilou.faq)}

## Rates (${SITE_URL}/rates)

Weekly rates in USD by bedrooms in use; a ${VILLA.touristTaxPercent}% tourist tax is added, everything else (housekeeping, concierge, Wi-Fi, linens) is included. Minimum stay ${rates.minStay} nights, ${rates.minStayPeak} over the festive weeks. ${Math.round(rates.depositPercent * 100)}% deposit at signature, balance ${VILLA.balanceDaysBefore} days before arrival.

| Season | Dates | 2 bedrooms | 3 bedrooms | 4 bedrooms |
|---|---|---|---|---|
${rateRows}

| Festive week | Dates | Rate |
|---|---|---|
${holidayRows}

Live availability and an instant quote for any dates: ${SITE_URL}/booking

## Frequently asked questions (${SITE_URL}/faq)

${qa(en.faq.items.filter((i) => i.tag !== "loyalty"))}

## St Barth guide (${SITE_URL}/guide)

${en.guideIntro}

### ${en.guideHub.factsTitle}

${bullets(en.guideHub.facts)}

${guideText("en")}

## St Barth map (${SITE_URL}/map)

${en.map.text} ${en.map.intro}

### ${en.map.areasTitle}

${en.map.areasIntro}

${bullets(en.map.areas)}

### ${en.map.beachesByUse}

${bullets(en.map.beachUses)}

### ${en.map.gettingAround}

${en.map.gettingAroundText}

${en.map.gettingAroundTips.map((t) => `- ${t}`).join("\n")}

### ${en.map.faqTitle}

${qa(en.map.faq)}

### Directory — every place on the map, with its drive time from the villa

${directory}

## Guest reviews (${SITE_URL}/reviews)

${
  reviews.length
    ? reviews
        .map((r) => `- ${"★".repeat(r.rating)} ${r.name}${r.country ? ` (${r.country})` : ""}: "${r.message.replace(/\s+/g, " ").trim()}"`)
        .join("\n")
    : "Reviews are published after each stay; see the page."
}

## Why book direct (${SITE_URL}/why-book-direct)

${en.compare.intro}

${en.compare.rows.map(([k, direct, agency]) => `- **${k}** — direct: ${direct} · agency: ${agency}`).join("\n")}

${en.compare.note}

## Contact (${SITE_URL}/contact)

${en.contactOwner.ownerText}

${en.contactOwner.address} · ${OWNER_EMAIL} · ${OWNER_PHONE}

---

# En français — ${VILLA.name} (${SITE_URL}/fr)

${fr.meta.descHome}

## La villa en bref

${bullets(Object.values(fr.seo.facts))}

## Pointe Milou — le quartier (${SITE_URL}/fr/pointe-milou)

${fr.pointeMilou.intro}

${bullets(fr.pointeMilou.why)}

${bullets(fr.pointeMilou.whats)}

### ${fr.pointeMilou.faqTitle}

${qa(fr.pointeMilou.faq)}

## Questions fréquentes (${SITE_URL}/fr/faq)

${qa(fr.faq.items.filter((i) => i.tag !== "loyalty"))}

## Guide St Barth (${SITE_URL}/fr/guide)

${bullets(fr.guideHub.facts)}

${guideText("fr")}

## Carte de St Barth (${SITE_URL}/fr/map)

${bullets(fr.map.areas)}

### ${fr.map.faqTitle}

${qa(fr.map.faq)}
`;
}
