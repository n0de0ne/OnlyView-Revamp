"use client";

/**
 * The Leaflet layer of the island map: the villa pin, one layer per
 * category (restaurants clustered), the selected pin, the guest's own
 * position and the itinerary drawing. Loaded with `ssr: false` — Leaflet
 * touches `window` at import time.
 *
 * There are no Leaflet popups: a tap on a pin tells the page (`onSelect`),
 * and the page shows the place in its sheet. The page drives the map with a
 * `command` (select a pin, draw or clear a route, zoom, recenter, locate)
 * and tells it how much of the canvas its panels cover (`insets`), so that
 * whatever the map flies to lands in the part that is still visible.
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
  pinStyle,
  type LatLng,
  type MapCategory,
  type MapPlaceDTO,
} from "./map-meta";
import { buildItinerary, fetchDrivingRoute, haversineM } from "./routing";

export type MapCommand =
  | { type: "select"; id: number; nonce: number }
  | { type: "route"; id: number; nonce: number }
  | { type: "clear"; nonce: number }
  | { type: "villa"; nonce: number }
  | { type: "fit"; nonce: number }
  | { type: "zoom"; delta: 1 | -1; nonce: number }
  | { type: "locate"; nonce: number };

export interface RouteState {
  status: "loading" | "ok" | "approx";
  place: MapPlaceDTO;
  distanceM: number;
  durationS: number;
  walkM: number;
  navTarget: LatLng;
  via: LatLng[];
}

export type LocateStatus = "locating" | "ok" | "far" | "denied" | null;

/** pixels of the map canvas hidden under the page's own panels */
export interface MapInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MapLabels {
  villa: string;
  villaSub: string;
}

const ISLAND_BOUNDS = L.latLngBounds([17.868, -62.884], [17.932, -62.786]);
/** beyond this, the guest is not on the island: their dot would only zoom the map out to the ocean */
const ON_ISLAND_M = 25_000;

/** a round pin in a category colour with a white ring; selected, it lifts and shows its name */
function pinIcon(color: string, emoji: string, opts: { size?: number; selected?: boolean; name?: string } = {}) {
  const size = opts.size ?? 30;
  const sel = !!opts.selected;
  const s = sel ? Math.round(size * 1.45) : size;
  const label = sel && opts.name ? `<span class="map-pin-label">${esc(opts.name)}</span>` : "";
  return L.divIcon({
    html: `<span class="map-pin-wrap${sel ? " is-selected" : ""}"><span class="map-pin" style="--pin:${color};--size:${s}px">${emoji}</span>${label}</span>`,
    className: "",
    // selected, the tip of the balloon (8px under the disc) marks the spot
    iconSize: [s, sel ? s + 8 : s],
    iconAnchor: [s / 2, sel ? s + 8 : s / 2],
  });
}

const dotIcon = (color: string, size: number, text = "") =>
  L.divIcon({
    html: `<span class="map-dot" style="--pin:${color};--size:${size}px">${text}</span>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const meIcon = L.divIcon({
  html: `<span class="map-me"></span>`,
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function LeafletMap({
  villa,
  places,
  visible,
  command,
  selectedId,
  hoveredId,
  insets,
  labels,
  onRoute,
  onSelect,
  onLocate,
}: {
  villa: LatLng;
  places: MapPlaceDTO[];
  /** categories currently shown (all when empty) */
  visible: MapCategory[];
  command: MapCommand | null;
  selectedId: number | null;
  /** a list row under the pointer: its pin is highlighted */
  hoveredId: number | null;
  insets: MapInsets;
  labels: MapLabels;
  onRoute: (state: RouteState | null) => void;
  /** a pin was tapped (null: the map itself was) */
  onSelect: (id: number | null) => void;
  onLocate: (status: LocateStatus) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef<Map<MapCategory, L.LayerGroup>>(new Map());
  const markersRef = useRef<Map<number, { marker: L.Marker; group: L.LayerGroup; place: MapPlaceDTO }>>(new Map());
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const meRef = useRef<{ marker: L.Marker; circle: L.Circle; watch: number } | null>(null);
  const shownRef = useRef<number | null>(null);
  const cb = useRef({ onRoute, onSelect, onLocate });
  cb.current = { onRoute, onSelect, onLocate };
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  /* ── geometry that respects the panels ── */
  const pad = (extra = 32) => {
    const i = insetsRef.current;
    return {
      paddingTopLeft: L.point(i.left + extra, i.top + extra),
      paddingBottomRight: L.point(i.right + extra, i.bottom + extra),
    };
  };
  /** fly so that `ll` sits in the middle of the uncovered part of the canvas */
  function flyToVisible(ll: L.LatLngExpression, zoom: number) {
    const map = mapRef.current;
    if (!map) return;
    const i = insetsRef.current;
    const pt = map.project(ll, zoom).subtract(L.point((i.left - i.right) / 2, (i.top - i.bottom) / 2));
    const center = map.unproject(pt, zoom);
    if (reducedMotion()) map.setView(center, zoom, { animate: false });
    else map.flyTo(center, zoom, { duration: 0.7, easeLinearity: 0.2 });
  }
  function fitVisible(b: L.LatLngBounds, maxZoom = 16) {
    mapRef.current?.fitBounds(b, { ...pad(), maxZoom, animate: !reducedMotion() });
  }

  /* ── build the map once ── */
  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      // the cluster plugin extends the global `L`
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      if (cancelled) return;

      const map = L.map(el, {
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.25,
        wheelPxPerZoomLevel: 90,
        tapTolerance: 12,
      });
      mapRef.current = map;
      map.fitBounds(ISLAND_BOUNDS, { ...pad(8), animate: false });
      L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);
      // OpenStreetMap, softened in CSS (.island-map .leaflet-tile-pane) to a
      // quiet, pastel cartography close to the system maps: the pins carry
      // the colour, not the roads
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const villaMarker = L.marker(villa, {
        icon: pinIcon(VILLA_PIN_COLOR, "🏠", { size: 38 }),
        zIndexOffset: 1000,
        title: labelsRef.current.villa,
        keyboard: true,
      }).addTo(map);
      villaMarker.on("click", () => flyToVisible(villa, Math.max(map.getZoom(), 15)));

      const groups = groupsRef.current;
      for (const cat of MAP_CATEGORIES) {
        const g =
          cat === "restaurant"
            ? L.markerClusterGroup({
                maxClusterRadius: 36,
                showCoverageOnHover: false,
                disableClusteringAtZoom: 16,
                spiderfyOnMaxZoom: true,
                iconCreateFunction: (cluster) =>
                  L.divIcon({
                    html: `<span class="map-cluster">${cluster.getChildCount()}</span>`,
                    className: "",
                    iconSize: [36, 36],
                    iconAnchor: [18, 18],
                  }),
              })
            : L.layerGroup();
        groups.set(cat, g);
        g.addTo(map);
      }

      for (const p of places) {
        const { color, emoji } = pinStyle(p);
        const marker = L.marker([p.lat, p.lng], { icon: pinIcon(color, emoji), title: p.name, riseOnHover: true });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          cb.current.onSelect(p.id);
        });
        const group = groups.get(p.category)!;
        group.addLayer(marker);
        markersRef.current.set(p.id, { marker, group, place: p });
      }

      map.on("click", () => cb.current.onSelect(null));

      routeLayerRef.current = L.layerGroup().addTo(map);
      // the canvas changes size with the sheet, full screen and rotation
      ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      ro.observe(el);
      applyVisibility(visibleRef.current);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      routeAbortRef.current?.abort();
      if (meRef.current) navigator.geolocation?.clearWatch(meRef.current.watch);
      meRef.current = null;
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

  /* ── the selected pin lifts and shows its name ── */
  useEffect(() => {
    const prev = shownRef.current;
    if (prev === selectedId) return;
    const set = (id: number, selected: boolean) => {
      const e = markersRef.current.get(id);
      if (!e) return;
      const { color, emoji } = pinStyle(e.place);
      e.marker.setIcon(pinIcon(color, emoji, { selected, name: e.place.name }));
      e.marker.setZIndexOffset(selected ? 900 : 0);
    };
    if (prev != null) set(prev, false);
    if (selectedId != null) set(selectedId, true);
    shownRef.current = selectedId;
  }, [selectedId]);

  /* ── a hovered list row lights its pin ── */
  useEffect(() => {
    if (hoveredId == null) return;
    const el = markersRef.current.get(hoveredId)?.marker.getElement();
    el?.classList.add("is-hover");
    return () => el?.classList.remove("is-hover");
  }, [hoveredId]);

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
    const abort = new AbortController();
    routeAbortRef.current = abort;

    const it = buildItinerary(villa, place);
    const dest: LatLng = [place.lat, place.lng];
    let walkM = 0;
    for (const v of it.via) layer.addLayer(L.marker(v, { icon: dotIcon(ROUTE_COLOR, 12), zIndexOffset: 500, interactive: false }));
    if (it.walk) {
      const [park, end] = it.walk;
      layer.addLayer(L.marker(park, { icon: dotIcon(WALK_COLOR, 22, "P"), zIndexOffset: 600, interactive: false }));
      layer.addLayer(
        L.polyline([park, end], { color: WALK_COLOR, weight: 4, opacity: 0.95, dashArray: "1, 9", lineCap: "round", interactive: false })
      );
      walkM = haversineM(park, end);
    }
    const base = { place, walkM, navTarget: it.navTarget, via: it.via };
    cb.current.onRoute({ ...base, status: "loading", distanceM: 0, durationS: 0 });
    fitVisible(L.latLngBounds([villa, ...it.drive, dest]));

    const route = await fetchDrivingRoute(it.drive, abort.signal);
    if (abort.signal.aborted) return;
    if (route) {
      // the system maps' route: a wide halo under a bright line
      layer.addLayer(L.polyline(route.coords, { color: "#fff", weight: 10, opacity: 0.95, lineCap: "round", lineJoin: "round", interactive: false }));
      layer.addLayer(L.polyline(route.coords, { color: ROUTE_COLOR, weight: 5.5, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false }));
      fitVisible(L.latLngBounds([...route.coords, dest]));
      cb.current.onRoute({ ...base, status: "ok", distanceM: route.distanceM, durationS: route.durationS });
    } else {
      // no router: a straight dashed line and a crow-flies estimate
      layer.addLayer(L.polyline(it.drive, { color: ROUTE_COLOR, weight: 3, opacity: 0.5, dashArray: "6, 10", interactive: false }));
      let d = 0;
      for (let i = 1; i < it.drive.length; i++) d += haversineM(it.drive[i - 1], it.drive[i]);
      cb.current.onRoute({ ...base, status: "approx", distanceM: d, durationS: 0 });
    }
  }

  /* ── the guest's own position ── */
  function locate() {
    const map = mapRef.current;
    if (!map) return;
    if (!("geolocation" in navigator)) {
      cb.current.onLocate("denied");
      return;
    }
    if (meRef.current) {
      const ll = meRef.current.marker.getLatLng();
      if (haversineM(villa, [ll.lat, ll.lng]) < ON_ISLAND_M) flyToVisible(ll, Math.max(map.getZoom(), 15));
      else cb.current.onLocate("far");
      return;
    }
    cb.current.onLocate("locating");
    let first = true;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const ll: LatLng = [pos.coords.latitude, pos.coords.longitude];
        const onIsland = haversineM(villa, ll) < ON_ISLAND_M;
        if (!meRef.current) {
          const marker = L.marker(ll, { icon: meIcon, zIndexOffset: 1100, interactive: false });
          const circle = L.circle(ll, {
            radius: pos.coords.accuracy,
            color: "#0a84ff",
            weight: 1,
            opacity: 0.35,
            fillColor: "#0a84ff",
            fillOpacity: 0.1,
            interactive: false,
          });
          if (onIsland) {
            marker.addTo(map);
            circle.addTo(map);
          }
          meRef.current = { marker, circle, watch };
        } else {
          meRef.current.marker.setLatLng(ll);
          meRef.current.circle.setLatLng(ll).setRadius(pos.coords.accuracy);
        }
        if (first) {
          first = false;
          if (onIsland) {
            flyToVisible(ll, Math.max(map.getZoom(), 15));
            cb.current.onLocate("ok");
          } else {
            cb.current.onLocate("far");
          }
        }
      },
      () => {
        navigator.geolocation.clearWatch(watch);
        meRef.current = null;
        cb.current.onLocate("denied");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 }
    );
  }

  /* ── commands from the page ── */
  useEffect(() => {
    if (!command) return;
    const map = mapRef.current;
    if (!map) return;
    switch (command.type) {
      case "clear":
        clearRoute();
        return;
      case "villa":
        flyToVisible(villa, 15);
        return;
      case "fit":
        fitVisible(ISLAND_BOUNDS, 14);
        return;
      case "zoom":
        if (command.delta > 0) map.zoomIn(1);
        else map.zoomOut(1);
        return;
      case "locate":
        locate();
        return;
    }
    const entry = markersRef.current.get(command.id);
    if (!entry) return;
    if (command.type === "route") {
      void drawRoute(entry.place);
      return;
    }
    // select: open its cluster if it hides in one, then bring it into view
    const { marker, group } = entry;
    const g = group as L.LayerGroup & { zoomToShowLayer?: (m: L.Marker, cb: () => void) => void };
    const target = Math.max(map.getZoom(), 15);
    if (typeof g.zoomToShowLayer === "function" && !marker.getElement()) {
      flyToVisible(marker.getLatLng(), Math.max(target, 16));
    } else {
      flyToVisible(marker.getLatLng(), target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  return <div ref={elRef} className="h-full w-full" role="application" aria-label={labels.villaSub} />;
}
