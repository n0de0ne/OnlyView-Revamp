/**
 * Facts about the villa that never come from the database — the things a
 * search engine or an AI answer engine should be able to state without
 * ambiguity. Plain constants, importable from anywhere (no Prisma here).
 *
 * The owner-editable counterparts (email, phone, WhatsApp, map link, social
 * profiles) live in Réglages → Contact and are read through lib/contact.
 */
export const VILLA = {
  name: "Villa ONLY VIEW",
  alternateNames: [
    "Villa Only View",
    "Only View St Barth",
    "Only View St Barths",
    "Villa Only View St Barth",
    "Only View Pointe Milou",
    "Villa Only View Pointe Milou",
    // the agencies and most English-speaking searchers write "St Barts"
    "Only View St Barts",
    "Villa Only View St Barts",
    "Only View Saint-Barthélemy",
    "Villa Only View Saint-Barthélemy",
  ],
  legalOwner: "SCI Efis",
  ownerFirstName: "Annie",
  ownerName: "Annie Chriqui",
  neighbourhood: "Pointe Milou",
  island: "Saint-Barthélemy",
  islandShort: "St Barth",
  postalCode: "97133",
  country: "FR",
  lat: 17.914904,
  lng: -62.816212,
  bedrooms: 4,
  bathrooms: 4,
  guests: 8,
  sizeM2: 200,
  checkin: "15:00",
  checkout: "11:00",
  minNights: 4,
  minNightsFestive: 7,
  touristTaxPercent: 5,
  depositPercent: 30,
  balanceDaysBefore: 30,
  /** approximate drive times from the villa — quoted on several pages */
  distances: [
    { key: "airport", en: "Gustaf III Airport (SBH)", fr: "Aéroport Gustaf III (SBH)", minutes: 10 },
    { key: "gustavia", en: "Gustavia (harbour, shopping)", fr: "Gustavia (port, boutiques)", minutes: 12 },
    { key: "lorient", en: "Lorient beach", fr: "Plage de Lorient", minutes: 5 },
    { key: "stjean", en: "St-Jean beach & Eden Rock", fr: "Plage de St-Jean & Eden Rock", minutes: 8 },
    { key: "nikki", en: "Nikki Beach (St-Jean)", fr: "Nikki Beach (St-Jean)", minutes: 8 },
    { key: "christopher", en: "Hotel Le Christopher (next door)", fr: "Hôtel Le Christopher (voisin)", minutes: 1 },
    { key: "sereno", en: "Le Sereno & Grand Cul-de-Sac lagoon", fr: "Le Sereno & lagon de Grand Cul-de-Sac", minutes: 7 },
    { key: "supermarket", en: "Supermarket (Oasis, Lorient)", fr: "Supermarché (Oasis, Lorient)", minutes: 5 },
    { key: "saline", en: "Saline & Gouverneur beaches", fr: "Plages de Saline & Gouverneur", minutes: 17 },
    { key: "toiny", en: "Le Toiny", fr: "Le Toiny", minutes: 12 },
  ],
} as const;

/** Date the content was last materially revised — surfaced as lastmod /
    dateModified. Bump it when the copy changes, not on every deploy. */
export const CONTENT_UPDATED = "2026-10-25";

/**
 * The island and the neighbourhood as entities — the anchors AI engines and
 * Google use to tell *this* Pointe Milou from any other string of words.
 * Wikidata/Wikipedia links give the island a stable identity; Pointe Milou
 * has no public entity of its own, so the site's Place node is it.
 */
export const ISLAND = {
  name: "Saint-Barthélemy",
  aliases: ["St Barth", "St Barts", "St. Barths", "Saint Barth", "St Barthélemy", "Saint-Barth"],
  /** overseas collectivity of France, Leeward Islands */
  country: "FR",
  areaKm2: 25,
  airportIata: "SBH",
  airportName: "Gustaf III Airport",
  timezone: "UTC−4 (Atlantic Standard Time, no daylight saving)",
  currency: "EUR",
  wikidata: "https://www.wikidata.org/wiki/Q25362",
  wikipedia: "https://en.wikipedia.org/wiki/Saint_Barth%C3%A9lemy",
  tourismOffice: "https://www.saintbarth-tourisme.com",
} as const;

export const POINTE_MILOU = {
  name: "Pointe Milou",
  /** the headland's own point, a few hundred metres from the villa */
  lat: 17.9155,
  lng: -62.8165,
  /** the beaches either side of the headland */
  nearestBeach: "Lorient",
  nearestBeachMinutes: 5,
} as const;

export const OWNER_EMAIL = "annaerick971@gmail.com";
export const OWNER_PHONE = "+590 690 39 90 47";
export const OWNER_WHATSAPP = "+590690399047";
/** the villa's pin, shared by the owner */
export const VILLA_MAP_URL = "https://maps.app.goo.gl/9eV7KhFcF9AJdWeLA";

/** House rule: at most two guests per bedroom in use. */
export const GUESTS_PER_BEDROOM = 2;

/** Most guests allowed for a stay that opens `bedrooms` bedrooms. */
export function maxGuestsFor(bedrooms: number): number {
  return Math.max(1, Math.round(bedrooms)) * GUESTS_PER_BEDROOM;
}
