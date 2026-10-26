/**
 * Where the public site shows a line icon next to a piece of copy, and the
 * icon each spot starts with. Stored as the shared text block "icons"
 * (Admin → Textes du site → Accueil → Icônes); this file only seeds it, and
 * gives the admin a French name for every spot.
 */
export const ICON_SLOTS = {
  badges: {
    label: "Atouts sous la présentation (accueil)",
    items: {
      bedrooms: ["Chambres", "bed"],
      guests: ["Personnes", "users"],
      pool: ["Piscine", "pool"],
      view: ["Vue mer", "sunset"],
    },
  },
  facts: {
    label: "Chiffres clés (tableau « en un coup d'œil »)",
    items: {
      type: ["Propriété", "house"],
      location: ["Emplacement", "pin"],
      bedrooms: ["Chambres", "bed"],
      guests: ["Personnes", "users"],
      size: ["Surface", "size"],
      pool: ["Piscine", "pool"],
      view: ["Vue", "view"],
      services: ["Inclus", "concierge"],
      airport: ["Aéroport", "plane"],
      beaches: ["Plages", "beach"],
      rates: ["Tarifs", "price"],
      booking: ["Réservation", "calendar"],
    },
  },
  amenities: {
    label: "Équipements (accueil et page villa)",
    items: {
      wifi: ["Wi-Fi", "wifi"],
      ac: ["Climatisation", "snowflake"],
      pool: ["Piscine chauffée", "pool"],
      kitchen: ["Cuisine", "kitchen"],
      sonos: ["Sonos", "speaker"],
      tv: ["Smart TV", "tv"],
      bbq: ["Barbecue", "bbq"],
      parking: ["Parking", "parking"],
      safe: ["Coffres-forts", "safe"],
      concierge: ["Conciergerie", "concierge"],
      housekeeping: ["Ménage quotidien", "housekeeping"],
      linens: ["Linge de maison", "linens"],
    },
  },
  location: {
    label: "Emplacement (accueil)",
    items: {
      airport: ["Aéroport", "plane"],
      beach: ["Plage de Lorient", "beach"],
      gustavia: ["Gustavia", "anchor"],
      restaurants: ["Restaurants", "restaurant"],
    },
  },
} as const satisfies Record<string, { label: string; items: Record<string, readonly [string, string]> }>;

type Slots = typeof ICON_SLOTS;
export type IconSet = { [G in keyof Slots]: { [K in keyof Slots[G]["items"]]: string } };

export const ICON_DEFAULTS = Object.fromEntries(
  Object.entries(ICON_SLOTS).map(([group, { items }]) => [
    group,
    Object.fromEntries(Object.entries(items).map(([k, [, icon]]) => [k, icon])),
  ])
) as IconSet;
