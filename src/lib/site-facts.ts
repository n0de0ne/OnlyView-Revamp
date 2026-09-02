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
  alternateNames: ["Only View St Barth", "Villa Only View St Barth", "Only View Pointe Milou"],
  legalOwner: "SCI Efis",
  ownerFirstName: "Annie",
  ownerName: "Annie Chriqui",
  neighbourhood: "Pointe Milou",
  island: "Saint-Barthélemy",
  islandShort: "St Barth",
  postalCode: "97133",
  country: "FR",
  lat: 17.9124,
  lng: -62.8272,
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
export const CONTENT_UPDATED = "2026-09-02";

export const OWNER_EMAIL = "annaerick971@gmail.com";
export const OWNER_PHONE = "+590 690 39 90 47";
export const OWNER_WHATSAPP = "+590690399047";
/** the villa's pin, shared by the owner */
export const VILLA_MAP_URL = "https://maps.app.goo.gl/9eV7KhFcF9AJdWeLA";
