/**
 * Itineraries from the guest's position or the villa. Driving legs come from the public OSRM
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
  /** one per pair of consecutive points asked for */
  legs: Array<{ distanceM: number; durationS: number }>;
}

export interface Itinerary {
  /** origin → via-points → where the car stops */
  drive: LatLng[];
  /** car park → place, on foot (only for walk-in places) */
  walk: [LatLng, LatLng] | null;
  /** intermediate pins to draw (via-points, the car park excluded) */
  via: LatLng[];
  /** where Google Maps / Waze should navigate to */
  navTarget: LatLng;
}

/**
 * The via-points were placed for the drive from the villa. From the guest's
 * own position (`fromGuest`) only those still ahead of them apply: a
 * turn-off farther from the place than the guest already is would send
 * them back the way they came. The car park of a walk-in place always
 * stays — it is where the drive ends.
 */
export function buildItinerary(
  origin: LatLng,
  place: { lat: number; lng: number; waypoints: string | null; walkFromLastWaypoint: boolean },
  opts: { fromGuest?: boolean } = {}
): Itinerary {
  const dest: LatLng = [place.lat, place.lng];
  const all = parseWaypoints(place.waypoints);
  const walk = place.walkFromLastWaypoint && all.length > 0;
  let via = all;
  if (opts.fromGuest) {
    const mine = haversineM(origin, dest);
    via = all.filter((v, i) => (walk && i === all.length - 1) || haversineM(v, dest) < mine);
  }
  if (walk) {
    const park = via[via.length - 1];
    return {
      drive: [origin, ...via],
      walk: [park, dest],
      via: via.slice(0, -1),
      navTarget: park,
    };
  }
  return { drive: [origin, ...via, dest], walk: null, via, navTarget: dest };
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
        legs?: Array<{ distance: number; duration: number }>;
      }>;
    };
    const route = data.code === "Ok" ? data.routes?.[0] : undefined;
    if (!route) return null;
    return {
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
      distanceM: route.distance,
      durationS: route.duration,
      legs: (route.legs ?? []).map((l) => ({ distanceM: l.distance, durationS: l.duration })),
    };
  } catch {
    return null;
  }
}

/** a via-point this close to the pin is the place's own approach, not a turn-off on the way */
const APPROACH_M = 300;

/**
 * The router snaps the pin to its nearest road. When the via-points lead the
 * car up a lane but the pin lies a few metres closer to another road, the
 * last leg turns into a detour — up the lane, round the block and back to
 * that other road, which is what Gypsea's itinerary showed. Such a leg is
 * recognised by its length against the straight line it replaces.
 */
export function lastLegIsDetour(legM: number, crowM: number): boolean {
  return crowM < APPROACH_M && legM > Math.max(2.5 * crowM, crowM + 150);
}

export interface RoutedDrive extends DrivingRoute {
  /** the drive stops at the last via-point: the router only reached the pin by a detour */
  trimmed: boolean;
}

/**
 * The drive of an itinerary, routed. A detour on the last leg (see
 * `lastLegIsDetour`) is dropped: the drive then ends at the last via-point,
 * and the pin is a few steps away.
 */
export async function routeDrive(it: Itinerary, signal?: AbortSignal): Promise<RoutedDrive | null> {
  const route = await fetchDrivingRoute(it.drive, signal);
  if (!route) return null;
  const n = it.drive.length;
  // only a drive through via-points that ends on the pin itself can end on a detour
  if (it.walk || n < 3 || route.legs.length !== n - 1) return { ...route, trimmed: false };
  const last = route.legs[n - 2];
  if (!lastLegIsDetour(last.distanceM, haversineM(it.drive[n - 2], it.drive[n - 1]))) {
    return { ...route, trimmed: false };
  }
  const short = await fetchDrivingRoute(it.drive.slice(0, -1), signal);
  return short ? { ...short, trimmed: true } : { ...route, trimmed: false };
}

/** farther than this from the road the drive starts or ends on, the gap is drawn as dotted steps */
export const OFF_ROAD_M = 25;

/** the dotted steps between the road and an off-road point (the pin on its beach, the guest's own position) */
export const STEPS_STYLE = {
  weight: 3,
  opacity: 0.8,
  dashArray: "1, 8",
  lineCap: "round" as const,
  interactive: false,
};

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

/** `origin: null` lets Google Maps start from the device's own position */
export function googleMapsDirectionsUrl(origin: LatLng | null, dest: LatLng, via: LatLng[] = []) {
  const p = new URLSearchParams({
    api: "1",
    destination: `${dest[0]},${dest[1]}`,
    travelmode: "driving",
  });
  if (origin) p.set("origin", `${origin[0]},${origin[1]}`);
  if (via.length) p.set("waypoints", via.map(([a, b]) => `${a},${b}`).join("|"));
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export const wazeUrl = (dest: LatLng) =>
  `https://waze.com/ul?ll=${dest[0]},${dest[1]}&navigate=yes`;

export const fmtKm = (m: number) => `${(m / 1000).toFixed(1)} km`;
export const fmtWalk = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
