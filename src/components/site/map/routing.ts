/**
 * Itineraries from the villa. Driving legs come from the public OSRM
 * router (the same service the legacy map used), forced through the
 * place's via-points; when a place is reached on foot from a car park the
 * last via-point ends the drive and a straight walking leg finishes it.
 */
import { parseWaypoints, type LatLng } from "./map-meta";

export const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export interface DrivingRoute {
  /** [lat, lng] polyline */
  coords: LatLng[];
  distanceM: number;
  durationS: number;
}

export interface Itinerary {
  /** villa → via-points → where the car stops */
  drive: LatLng[];
  /** car park → place, on foot (only for walk-in places) */
  walk: [LatLng, LatLng] | null;
  /** intermediate pins to draw (via-points, the car park excluded) */
  via: LatLng[];
  /** where Google Maps / Waze should navigate to */
  navTarget: LatLng;
}

export function buildItinerary(
  villa: LatLng,
  place: { lat: number; lng: number; waypoints: string | null; walkFromLastWaypoint: boolean }
): Itinerary {
  const via = parseWaypoints(place.waypoints);
  const dest: LatLng = [place.lat, place.lng];
  if (place.walkFromLastWaypoint && via.length) {
    const park = via[via.length - 1];
    return {
      drive: [villa, ...via],
      walk: [park, dest],
      via: via.slice(0, -1),
      navTarget: park,
    };
  }
  return { drive: [villa, ...via, dest], walk: null, via, navTarget: dest };
}

export async function fetchDrivingRoute(
  points: LatLng[],
  signal?: AbortSignal
): Promise<DrivingRoute | null> {
  if (points.length < 2) return null;
  const path = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  try {
    const res = await fetch(`${OSRM_URL}/${path}?overview=full&geometries=geojson&steps=false`, {
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry: { coordinates: Array<[number, number]> };
      }>;
    };
    const route = data.code === "Ok" ? data.routes?.[0] : undefined;
    if (!route) return null;
    return {
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
      distanceM: route.distance,
      durationS: route.duration,
    };
  } catch {
    return null;
  }
}

/** great-circle distance in metres */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** ~80 m per minute, never less than a minute */
export const walkMinutes = (m: number) => Math.max(1, Math.round(m / 80));

export function googleMapsDirectionsUrl(origin: LatLng, dest: LatLng, via: LatLng[] = []) {
  const p = new URLSearchParams({
    api: "1",
    origin: `${origin[0]},${origin[1]}`,
    destination: `${dest[0]},${dest[1]}`,
    travelmode: "driving",
  });
  if (via.length) p.set("waypoints", via.map(([a, b]) => `${a},${b}`).join("|"));
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export const wazeUrl = (dest: LatLng) =>
  `https://waze.com/ul?ll=${dest[0]},${dest[1]}&navigate=yes`;

export const fmtKm = (m: number) => `${(m / 1000).toFixed(1)} km`;
export const fmtWalk = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
