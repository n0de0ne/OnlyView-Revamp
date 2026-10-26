import { prisma } from "./db";
import { getSettings } from "./settings";
import { VILLA } from "./site-facts";
import type { Locale } from "./i18n";
import seed from "@/data/map-places.json";
import {
  MAP_CATEGORIES,
  type LatLng,
  type MapCategory,
  type MapPlaceDTO,
} from "@/components/site/map/map-meta";

/** URL slug of a place name, as the admin generates it on create. */
export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "place";

/** A restaurant whose online booking link is filled in (or changed) is
 *  offered as "Réservation en ligne" in the guest portal. Only on a new or
 *  changed link, so the owner can still pick another mode afterwards. */
export function withOnlineBooking<
  T extends { category?: string; bookingUrl?: string | null; bookingMode?: string | null },
>(data: T, previous?: { category: string; bookingUrl: string | null } | null): T {
  const category = data.category ?? previous?.category;
  const url = data.bookingUrl;
  if (category !== "restaurant" || !url || url === previous?.bookingUrl) return data;
  return { ...data, bookingMode: "direct" };
}

type Row = {
  id: number;
  slug: string;
  category: string;
  kind: string | null;
  name: string;
  zone: string | null;
  lat: number;
  lng: number;
  descriptionEn: string | null;
  descriptionFr: string | null;
  driveMinutes: number | null;
  waypoints: string | null;
  walkFromLastWaypoint: boolean;
  website: string | null;
  phone: string | null;
  bookingUrl?: string | null;
  sortOrder: number;
};

const catRank = (c: string) => {
  const i = MAP_CATEGORIES.indexOf(c as MapCategory);
  return i === -1 ? MAP_CATEGORIES.length : i;
};

function toDto(row: Row, locale: Locale): MapPlaceDTO {
  return {
    id: row.id,
    slug: row.slug,
    category: (MAP_CATEGORIES.includes(row.category as MapCategory)
      ? row.category
      : "restaurant") as MapCategory,
    kind: row.kind,
    name: row.name,
    zone: row.zone,
    lat: row.lat,
    lng: row.lng,
    description:
      locale === "fr"
        ? row.descriptionFr ?? row.descriptionEn
        : row.descriptionEn ?? row.descriptionFr,
    driveMinutes: row.driveMinutes,
    waypoints: row.waypoints,
    walkFromLastWaypoint: row.walkFromLastWaypoint,
    website: row.website,
    phone: row.phone,
    bookingUrl: row.bookingUrl ?? null,
  };
}

/**
 * Every active pin, in the order the page lists them (category, then the
 * admin's order). Without a database (image build) the shipped seed serves,
 * so the page always renders.
 */
export async function getMapPlaces(locale: Locale): Promise<MapPlaceDTO[]> {
  let rows: Row[];
  try {
    rows = await prisma.mapPlace.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  } catch {
    rows = (seed as Array<Omit<Row, "id">>).map((p, i) => ({ ...p, id: -(i + 1) }));
  }
  return rows
    .sort((a, b) => catRank(a.category) - catRank(b.category) || a.sortOrder - b.sortOrder)
    .map((r) => toDto(r, locale));
}

/** The pin every itinerary starts from: Réglages → Contact, else the constant. */
export async function getVillaPoint(): Promise<LatLng> {
  const s = await getSettings();
  const lat = parseFloat(s.villa_lat ?? "");
  const lng = parseFloat(s.villa_lng ?? "");
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return [VILLA.lat, VILLA.lng];
}
