"use client";

/**
 * The Leaflet layer of the island map: the villa pin, one layer per
 * category (restaurants clustered), popups, and the itinerary drawing.
 * Loaded with `ssr: false` — Leaflet touches `window` at import time.
 *
 * The parent drives it with a `command` (focus a pin, draw or clear a
 * route) and listens to `onRoute` / `onSelect`; everything else is local.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import {
  MAP_CATEGORIES,
  ROUTE_COLOR,
  VILLA_PIN_COLOR,
  WALK_COLOR,
  kindLabel,
  pinStyle,
  type LatLng,
  type MapCategory,
  type MapPlaceDTO,
} from "./map-meta";
import { buildItinerary, fetchDrivingRoute, googleMapsDirectionsUrl, haversineM } from "./routing";

export type MapCommand =
  | { type: "focus"; id: number; nonce: number }
  | { type: "route"; id: number; nonce: number }
  | { type: "clear"; nonce: number };

export interface RouteState {
  status: "loading" | "ok" | "approx";
  place: MapPlaceDTO;
  distanceM: number;
  durationS: number;
  walkM: number;
  navTarget: LatLng;
  via: LatLng[];
}

export interface MapLabels {
  villa: string;
  villaSub: string;
  min: string;
  route: string;
  openMaps: string;
  website: string;
  call: string;
  parking: string;
  locale: "en" | "fr";
}

const ISLAND_CENTER: LatLng = [17.9015, -62.832];

/** a round pin in a category colour with a fine white ring — the site's dots */
function pinIcon(color: string, emoji: string, size = 30) {
  return L.divIcon({
    html: `<span class="map-pin" style="--pin:${color};--size:${size}px">${emoji}</span>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

const dotIcon = (color: string, size: number, text = "") =>
  L.divIcon({
    html: `<span class="map-dot" style="--pin:${color};--size:${size}px">${text}</span>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function LeafletMap({
  villa,
  places,
  visible,
  command,
  labels,
  onRoute,
  onSelect,
}: {
  villa: LatLng;
  places: MapPlaceDTO[];
  /** categories currently shown (all when empty) */
  visible: MapCategory[];
  command: MapCommand | null;
  labels: MapLabels;
  onRoute: (state: RouteState | null) => void;
  /** a pin's popup opened (null: closed) */
  onSelect: (id: number | null) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef<Map<MapCategory, L.LayerGroup>>(new Map());
  const markersRef = useRef<Map<number, { marker: L.Marker; group: L.LayerGroup }>>(new Map());
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const cb = useRef({ onRoute, onSelect });
  cb.current = { onRoute, onSelect };
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  /* ── build the map once ── */
  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;
    let cancelled = false;

    (async () => {
      // the cluster plugin extends the global `L`
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      if (cancelled) return;

      const map = L.map(el, { center: ISLAND_CENTER, zoom: 13, zoomControl: false });
      mapRef.current = map;
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.marker(villa, { icon: pinIcon(VILLA_PIN_COLOR, "🏠", 38), zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(
          `<div class="map-popup"><p class="map-popup-kicker">${esc(labelsRef.current.villaSub)}</p><p class="map-popup-name">${esc(labelsRef.current.villa)}</p></div>`
        );

      const groups = groupsRef.current;
      for (const cat of MAP_CATEGORIES) {
        const g =
          cat === "restaurant"
            ? L.markerClusterGroup({
                maxClusterRadius: 36,
                showCoverageOnHover: false,
                disableClusteringAtZoom: 16,
                iconCreateFunction: (cluster) =>
                  L.divIcon({
                    html: `<span class="map-cluster">${cluster.getChildCount()}</span>`,
                    className: "",
                    iconSize: [34, 34],
                    iconAnchor: [17, 17],
                  }),
              })
            : L.layerGroup();
        groups.set(cat, g);
        g.addTo(map);
      }

      const lb = labelsRef.current;
      for (const p of places) {
        const { color, emoji } = pinStyle(p);
        const marker = L.marker([p.lat, p.lng], { icon: pinIcon(color, emoji), title: p.name });
        const popup = document.createElement("div");
        popup.className = "map-popup";
        const kicker = [kindLabel(p, lb.locale), p.zone, p.driveMinutes ? `${p.driveMinutes} ${lb.min}` : null]
          .filter(Boolean)
          .map((s) => esc(String(s)))
          .join(" · ");
        const it = buildItinerary(villa, p);
        const mapsUrl = googleMapsDirectionsUrl(villa, it.navTarget, it.via);
        popup.innerHTML =
          `<p class="map-popup-kicker">${kicker}</p>` +
          `<p class="map-popup-name">${esc(p.name)}</p>` +
          (p.description ? `<p class="map-popup-desc">${esc(p.description)}</p>` : "") +
          (p.walkFromLastWaypoint ? `<p class="map-popup-note">${esc(lb.parking)}</p>` : "") +
          `<div class="map-popup-actions">` +
          `<button type="button" class="map-popup-btn" data-route>${esc(lb.route)}</button>` +
          `<a class="map-popup-link" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${esc(lb.openMaps)} ↗</a>` +
          (p.website
            ? `<a class="map-popup-link" href="${esc(p.website)}" target="_blank" rel="noopener noreferrer">${esc(lb.website)} ↗</a>`
            : "") +
          (p.phone ? `<a class="map-popup-link" href="tel:${esc(p.phone.replace(/\s+/g, ""))}">${esc(lb.call)}</a>` : "") +
          `</div>`;
        popup.querySelector<HTMLButtonElement>("[data-route]")!.addEventListener("click", () => {
          void drawRoute(p);
        });
        marker.bindPopup(popup, { maxWidth: 300, closeButton: false });
        marker.on("popupopen", () => cb.current.onSelect(p.id));
        marker.on("popupclose", () => cb.current.onSelect(null));
        const group = groups.get(p.category)!;
        group.addLayer(marker);
        markersRef.current.set(p.id, { marker, group });
      }

      routeLayerRef.current = L.layerGroup().addTo(map);
      // the container gets its final size after the first paint
      setTimeout(() => map.invalidateSize(), 100);
      applyVisibility(visibleRef.current);
    })();

    return () => {
      cancelled = true;
      routeAbortRef.current?.abort();
      mapRef.current?.remove();
      mapRef.current = null;
      groupsRef.current = new Map();
      markersRef.current = new Map();
    };
    // the pins are static for the page's life; a new set means a new page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── category filter ── */
  function applyVisibility(cats: MapCategory[]) {
    const map = mapRef.current;
    if (!map) return;
    for (const [cat, g] of groupsRef.current) {
      const show = cats.length === 0 || cats.includes(cat);
      if (show && !map.hasLayer(g)) map.addLayer(g);
      if (!show && map.hasLayer(g)) map.removeLayer(g);
    }
  }
  useEffect(() => {
    applyVisibility(visible);
  }, [visible]);

  /* ── itinerary ── */
  function clearRoute() {
    routeAbortRef.current?.abort();
    routeAbortRef.current = null;
    routeLayerRef.current?.clearLayers();
    cb.current.onRoute(null);
  }

  async function drawRoute(place: MapPlaceDTO) {
    const map = mapRef.current;
    const layer = routeLayerRef.current;
    if (!map || !layer) return;
    clearRoute();
    map.closePopup();
    const abort = new AbortController();
    routeAbortRef.current = abort;

    const it = buildItinerary(villa, place);
    const dest: LatLng = [place.lat, place.lng];
    let walkM = 0;
    for (const v of it.via) layer.addLayer(L.marker(v, { icon: dotIcon(ROUTE_COLOR, 12), zIndexOffset: 500 }));
    if (it.walk) {
      const [park, end] = it.walk;
      layer.addLayer(L.marker(park, { icon: dotIcon(WALK_COLOR, 22, "P"), zIndexOffset: 600 }));
      layer.addLayer(
        L.polyline([park, end], { color: WALK_COLOR, weight: 3, opacity: 0.95, dashArray: "2, 9", lineCap: "round" })
      );
      walkM = haversineM(park, end);
    }
    const base = { place, walkM, navTarget: it.navTarget, via: it.via };
    cb.current.onRoute({ ...base, status: "loading", distanceM: 0, durationS: 0 });
    map.fitBounds(L.latLngBounds([villa, ...it.drive, dest]), { padding: [60, 60] });

    const route = await fetchDrivingRoute(it.drive, abort.signal);
    if (abort.signal.aborted) return;
    if (route) {
      layer.addLayer(L.polyline(route.coords, { color: "#fff", weight: 8, opacity: 0.9 }));
      layer.addLayer(L.polyline(route.coords, { color: ROUTE_COLOR, weight: 4, opacity: 0.95 }));
      map.fitBounds(L.latLngBounds([...route.coords, dest]), { padding: [60, 60] });
      cb.current.onRoute({ ...base, status: "ok", distanceM: route.distanceM, durationS: route.durationS });
    } else {
      // no router: a straight dashed line and a crow-flies estimate
      layer.addLayer(L.polyline(it.drive, { color: ROUTE_COLOR, weight: 3, opacity: 0.5, dashArray: "6, 10" }));
      let d = 0;
      for (let i = 1; i < it.drive.length; i++) d += haversineM(it.drive[i - 1], it.drive[i]);
      cb.current.onRoute({ ...base, status: "approx", distanceM: d, durationS: 0 });
    }
  }

  /* ── commands from the page ── */
  useEffect(() => {
    if (!command) return;
    const map = mapRef.current;
    if (!map) return;
    if (command.type === "clear") {
      clearRoute();
      return;
    }
    const entry = markersRef.current.get(command.id);
    if (!entry) return;
    const { marker, group } = entry;
    if (command.type === "route") {
      const place = places.find((p) => p.id === command.id);
      if (place) void drawRoute(place);
      return;
    }
    const open = () => {
      const g = group as L.LayerGroup & { zoomToShowLayer?: (m: L.Marker, cb: () => void) => void };
      if (typeof g.zoomToShowLayer === "function") g.zoomToShowLayer(marker, () => marker.openPopup());
      else marker.openPopup();
    };
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 16), { duration: 0.8 });
    const t = setTimeout(open, 850);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  return <div ref={elRef} className="h-full w-full" role="application" aria-label={labels.villaSub} />;
}
