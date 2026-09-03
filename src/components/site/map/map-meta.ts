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

export const CATEGORY_META: Record<
  MapCategory,
  { color: string; emoji: string; en: string; fr: string }
> = {
  beach: { color: "#2196F3", emoji: "🏖️", en: "Beaches", fr: "Plages" },
  restaurant: { color: "#1B4965", emoji: "🍽️", en: "Restaurants", fr: "Restaurants" },
  supermarket: { color: "#4CAF50", emoji: "🛒", en: "Supermarkets", fr: "Supermarchés" },
  bakery: { color: "#E67E22", emoji: "🥐", en: "Bakeries", fr: "Boulangeries" },
  pharmacy: { color: "#E53935", emoji: "💊", en: "Pharmacies", fr: "Pharmacies" },
  transport: { color: "#607D8B", emoji: "✈️", en: "Transport", fr: "Transport" },
  sport: { color: "#00BCD4", emoji: "🏋️", en: "Sports", fr: "Sport" },
};

/** icon variants inside a category (the legacy map's per-type pins) */
export const KIND_META: Record<string, { color?: string; emoji: string; en: string; fr: string }> = {
  restaurant: { emoji: "🍽️", en: "Restaurant", fr: "Restaurant" },
  beach_club: { color: "#2196F3", emoji: "🏖️", en: "Beach club", fr: "Beach club" },
  lounge: { color: "#9C27B0", emoji: "🍷", en: "Lounge / bar", fr: "Lounge / bar" },
  snack: { color: "#FF9800", emoji: "🍔", en: "Snack / casual", fr: "Snack / décontracté" },
  nightlife: { color: "#E91E63", emoji: "🌟", en: "Nightlife", fr: "Soirée" },
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

export const VILLA_PIN_COLOR = "#C4973B";
export const ROUTE_COLOR = "#1B4965";
export const WALK_COLOR = "#FF5722";

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
