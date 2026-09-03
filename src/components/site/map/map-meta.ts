/**
 * What the island map knows about its pins — shared by the public page, the
 * Leaflet layer and the admin editor (no server imports here).
 */

export type MapCategory =
  | "beach"
  | "restaurant"
  | "supermarket"
  | "bakery"
  | "pharmacy"
  | "transport"
  | "sport";

export const MAP_CATEGORIES: MapCategory[] = [
  "beach",
  "restaurant",
  "supermarket",
  "bakery",
  "pharmacy",
  "transport",
  "sport",
];

/** pin colours in the site's palette (ocean, navy, gold…) — one hue per category */
export const CATEGORY_META: Record<
  MapCategory,
  { color: string; emoji: string; en: string; fr: string; one: { en: string; fr: string } }
> = {
  beach: { color: "#5a8fa8", emoji: "🏖️", en: "Beaches", fr: "Plages", one: { en: "Beach", fr: "Plage" } },
  restaurant: { color: "#1b4965", emoji: "🍽️", en: "Restaurants", fr: "Restaurants", one: { en: "Restaurant", fr: "Restaurant" } },
  supermarket: { color: "#6b8f71", emoji: "🛒", en: "Supermarkets", fr: "Supermarchés", one: { en: "Supermarket", fr: "Supermarché" } },
  bakery: { color: "#c9a962", emoji: "🥐", en: "Bakeries", fr: "Boulangeries", one: { en: "Bakery", fr: "Boulangerie" } },
  pharmacy: { color: "#b5534a", emoji: "💊", en: "Pharmacies", fr: "Pharmacies", one: { en: "Pharmacy", fr: "Pharmacie" } },
  transport: { color: "#5b6773", emoji: "✈️", en: "Transport", fr: "Transport", one: { en: "Transport", fr: "Transport" } },
  sport: { color: "#3f8c8c", emoji: "🎾", en: "Sports", fr: "Sport", one: { en: "Sports", fr: "Sport" } },
};

/** icon variants inside a category (the legacy map's per-type pins) */
export const KIND_META: Record<string, { color?: string; emoji: string; en: string; fr: string }> = {
  restaurant: { emoji: "🍽️", en: "Restaurant", fr: "Restaurant" },
  beach_club: { color: "#3d7a94", emoji: "🏖️", en: "Beach club", fr: "Beach club" },
  lounge: { color: "#6f5a8c", emoji: "🍷", en: "Lounge / bar", fr: "Lounge / bar" },
  snack: { color: "#b8763f", emoji: "🍔", en: "Snack / casual", fr: "Snack / décontracté" },
  nightlife: { color: "#8c4a6b", emoji: "✨", en: "Nightlife", fr: "Soirée" },
  gas: { emoji: "⛽", en: "Gas station", fr: "Station-service" },
  airport: { emoji: "✈️", en: "Airport", fr: "Aéroport" },
  ferry: { emoji: "⛴️", en: "Ferry", fr: "Ferry" },
  info: { emoji: "ℹ️", en: "Tourist office", fr: "Office de tourisme" },
  gym: { emoji: "🏋️", en: "Gym", fr: "Salle de sport" },
  court: { emoji: "🎾", en: "Court", fr: "Terrain" },
};

/** the kinds an admin can pick for a category */
export const KINDS_BY_CATEGORY: Partial<Record<MapCategory, string[]>> = {
  restaurant: ["restaurant", "beach_club", "lounge", "snack", "nightlife"],
  transport: ["gas", "airport", "ferry", "info"],
  sport: ["gym", "court"],
};

export const VILLA_PIN_COLOR = "#c9a962";
export const ROUTE_COLOR = "#1b4965";
export const WALK_COLOR = "#c9a962";

/** A pin as the public page receives it (one language already picked). */
export interface MapPlaceDTO {
  id: number;
  slug: string;
  category: MapCategory;
  kind: string | null;
  name: string;
  zone: string | null;
  lat: number;
  lng: number;
  description: string | null;
  driveMinutes: number | null;
  waypoints: string | null;
  walkFromLastWaypoint: boolean;
  website: string | null;
  phone: string | null;
}

export function pinStyle(place: { category: MapCategory; kind?: string | null }) {
  const cat = CATEGORY_META[place.category] ?? CATEGORY_META.restaurant;
  const kind = place.kind ? KIND_META[place.kind] : undefined;
  return { color: kind?.color ?? cat.color, emoji: kind?.emoji ?? cat.emoji };
}

/** the human label of a pin's type: the kind when it has one, else the category */
export function kindLabel(
  place: { category: MapCategory; kind?: string | null },
  locale: "en" | "fr"
): string {
  const kind = place.kind && place.kind !== "restaurant" ? KIND_META[place.kind] : undefined;
  if (kind) return locale === "fr" ? kind.fr : kind.en;
  const cat = CATEGORY_META[place.category] ?? CATEGORY_META.restaurant;
  return locale === "fr" ? cat.one.fr : cat.one.en;
}

export type LatLng = [number, number];

/** "lat,lng|lat,lng" → [[lat,lng], …]; garbage is skipped, not thrown */
export function parseWaypoints(s: string | null | undefined): LatLng[] {
  if (!s) return [];
  const out: LatLng[] = [];
  for (const part of s.split("|")) {
    const [a, b] = part.split(",").map((x) => parseFloat(x.trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) out.push([a, b]);
  }
  return out;
}

export function formatWaypoints(points: LatLng[]): string | null {
  if (!points.length) return null;
  return points.map(([a, b]) => `${a},${b}`).join("|");
}

export function isValidLatLng(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
